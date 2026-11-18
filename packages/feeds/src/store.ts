import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { FeedStoreStats, RawFeedItem, SearchOptions, StoredFeedItem } from './types.js';

/**
 * 信源累积库（单文件 SQLite，Node 内置 node:sqlite，零额外依赖）。
 *
 * 与 scholar 的索引库分工不同：那边是「一篇 PDF 按页切块 + FTS5 中文检索」，
 * 这边是「一条资讯一行」，靠 LIKE 检索就够（资讯总量在万级以内，且带时间过滤）。
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS feed_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  topics TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feed_items_published ON feed_items (published_at DESC);
CREATE INDEX IF NOT EXISTS feed_items_source ON feed_items (source_id);
`;

interface Row {
  id: string;
  source_id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string | null;
  topics: string;
  fetched_at: string;
}

const COLUMNS = 'id, source_id, title, summary, url, published_at, topics, fetched_at';

function toItem(row: Row): StoredFeedItem {
  const item: StoredFeedItem = {
    id: row.id,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    topics: row.topics === '' ? [] : row.topics.split(','),
    fetchedAt: row.fetched_at,
  };
  if (row.published_at !== null && row.published_at !== '') item.publishedAt = row.published_at;
  return item;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export class FeedStore {
  readonly file: string;
  private readonly db: DatabaseSync;

  constructor(file: string) {
    this.file = file;
    if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(SCHEMA);
  }

  /** 写入一批条目；已存在的只刷新标题/摘要（ID 就是去重键）。 */
  upsertMany(items: RawFeedItem[], fetchedAt: string): { added: number; skipped: number } {
    const insert = this.db.prepare(
      `INSERT INTO feed_items (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    );
    const update = this.db.prepare(
      'UPDATE feed_items SET title = ?, summary = ?, url = ?, topics = ?, fetched_at = ? WHERE id = ?',
    );
    let added = 0;
    let skipped = 0;
    this.db.exec('BEGIN');
    try {
      for (const item of items) {
        const result = insert.run(
          item.id,
          item.sourceId,
          item.title,
          item.summary,
          item.url,
          item.publishedAt ?? null,
          item.topics.join(','),
          fetchedAt,
        );
        if (Number(result.changes) === 1) {
          added += 1;
        } else {
          skipped += 1;
          update.run(item.title, item.summary, item.url, item.topics.join(','), fetchedAt, item.id);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return { added, skipped };
  }

  search(options: SearchOptions = {}): StoredFeedItem[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const query = options.query?.trim();
    if (query !== undefined && query !== '') {
      where.push('(lower(title) LIKE ? OR lower(summary) LIKE ?)');
      const like = `%${query.toLowerCase()}%`;
      params.push(like, like);
    }
    if (options.since !== undefined && options.since !== '') {
      where.push('COALESCE(published_at, fetched_at) >= ?');
      params.push(options.since);
    }
    if (options.sourceIds !== undefined && options.sourceIds.length > 0) {
      where.push(`source_id IN (${options.sourceIds.map(() => '?').join(', ')})`);
      params.push(...options.sourceIds);
    }
    if (options.topics !== undefined && options.topics.length > 0) {
      where.push(`(${options.topics.map(() => 'topics LIKE ?').join(' OR ')})`);
      params.push(...options.topics.map((topic) => `%${topic}%`));
    }
    const limit = clamp(options.limit ?? 20, 1, 100);
    const sql = `SELECT ${COLUMNS} FROM feed_items ${
      where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    } ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(...params, limit) as unknown as Row[];
    return rows.map(toItem);
  }

  stats(): FeedStoreStats {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS items, COUNT(DISTINCT source_id) AS sources,
                MIN(published_at) AS earliest, MAX(COALESCE(published_at, fetched_at)) AS latest
         FROM feed_items`,
      )
      .get() as unknown as { items: number; sources: number; earliest: string | null; latest: string | null };
    const stats: FeedStoreStats = { items: Number(row.items), sources: Number(row.sources) };
    if (row.earliest !== null && row.earliest !== '') stats.earliest = row.earliest;
    if (row.latest !== null && row.latest !== '') stats.latest = row.latest;
    return stats;
  }

  close(): void {
    this.db.close();
  }
}