/**
 * 本地全文索引：SQLite + FTS5，零原生依赖（Node 22.5+ 的 `node:sqlite`）。
 *
 * 设计取向：这是一个**个人文献库**，规模在几千到几万页之间，所以优先「简单、可迁移、
 * 可审计」而不是「分布式/高性能」。索引库就是一个文件，用户拷走就能带走。
 *
 * 表结构：
 * - `chunks`      正文分块（doc_key + page_no 唯一），存原文与元数据 JSON。
 * - `chunks_fts`  FTS5 索引，只存 `tokenizeText()` 产出的二元组串，rowid 与 chunks.id 对齐。
 */
import { DatabaseSync } from 'node:sqlite';
import { makeSnippet, planQuery, toIndexable } from './tokenize.js';

export interface ChunkInput {
  /** 文献唯一键。Zotero 场景用条目 key。 */
  docKey: string;
  /** 页码（1 起）。整篇无分页时用 1。 */
  page: number;
  text: string;
  /** 任意元数据（标题/作者/年份/DOI…），会原样存成 JSON。 */
  meta?: Record<string, unknown>;
}

export interface SearchHit {
  docKey: string;
  page: number;
  text: string;
  meta: Record<string, unknown>;
  /** FTS5 bm25 分数（越小越相关）。LIKE 兜底命中时为 0。 */
  score: number;
  snippet: string;
}

export interface SearchOptions {
  limit?: number;
  /** `strict` 只做短语匹配；`auto`（默认）严格模式结果不足时用 OR 放宽。 */
  mode?: 'strict' | 'auto';
}

export interface StoreStats {
  chunks: number;
  documents: number;
}

interface ChunkRow {
  id: number;
  doc_key: string;
  page_no: number;
  text: string;
  meta: string;
  score: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chunks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_key  TEXT    NOT NULL,
  page_no  INTEGER NOT NULL,
  text     TEXT    NOT NULL,
  meta     TEXT    NOT NULL DEFAULT '{}',
  UNIQUE (doc_key, page_no)
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(tok);
CREATE INDEX IF NOT EXISTS chunks_doc_key ON chunks (doc_key);
`;

export class ScholarStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
  }

  /** 写入/更新分块；同一 (docKey, page) 会被覆盖而不是重复。返回写入条数。 */
  upsertChunks(chunks: ChunkInput[]): number {
    const find = this.db.prepare('SELECT id FROM chunks WHERE doc_key = ? AND page_no = ?');
    const insert = this.db.prepare(
      'INSERT INTO chunks (doc_key, page_no, text, meta) VALUES (?, ?, ?, ?)',
    );
    const update = this.db.prepare('UPDATE chunks SET text = ?, meta = ? WHERE id = ?');
    const dropFts = this.db.prepare('DELETE FROM chunks_fts WHERE rowid = ?');
    const insertFts = this.db.prepare('INSERT INTO chunks_fts (rowid, tok) VALUES (?, ?)');

    this.db.exec('BEGIN');
    try {
      for (const chunk of chunks) {
        const tokens = toIndexable(chunk.text);
        const meta = JSON.stringify(chunk.meta ?? {});
        const existing = find.get(chunk.docKey, chunk.page) as { id: number } | undefined;
        let id: number;
        if (existing) {
          id = existing.id;
          update.run(chunk.text, meta, id);
          dropFts.run(id);
        } else {
          const result = insert.run(chunk.docKey, chunk.page, chunk.text, meta);
          id = Number(result.lastInsertRowid);
        }
        insertFts.run(id, tokens);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return chunks.length;
  }

  /** 删除一篇文献的全部索引，返回删除的块数。 */
  removeDocument(docKey: string): number {
    const ids = this.db.prepare('SELECT id FROM chunks WHERE doc_key = ?').all(docKey) as Array<{
      id: number;
    }>;
    if (ids.length === 0) return 0;
    const dropFts = this.db.prepare('DELETE FROM chunks_fts WHERE rowid = ?');
    const dropChunk = this.db.prepare('DELETE FROM chunks WHERE id = ?');
    this.db.exec('BEGIN');
    try {
      for (const { id } of ids) {
        dropFts.run(id);
        dropChunk.run(id);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return ids.length;
  }

  /** 全文检索。返回按相关度排序的命中片段。 */
  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const limit = options.limit ?? 10;
    const mode = options.mode ?? 'auto';
    const plan = planQuery(query);

    if (!plan.fts && plan.singleChars.length === 0) return [];

    const hits: SearchHit[] = [];
    const seen = new Set<number>();
    // 中文二元组只用来把片段窗口定位到命中处（不标方括号）。
    const anchors = toIndexable(query)
      .split(' ')
      .filter((token) => token.length >= 2);

    const collect = (rows: ChunkRow[]): void => {
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        // 单字条件在 FTS5 里无法表达，取回后在这里过一遍。
        if (!plan.singleChars.every((ch) => row.text.includes(ch))) continue;
        seen.add(row.id);
        hits.push(this.toHit(row, plan.terms, anchors));
        if (hits.length >= limit) return;
      }
    };

    if (plan.fts) {
      collect(this.matchFts(plan.fts, limit * 3));
    }

    if (hits.length === 0 && plan.singleChars.length > 0) {
      collect(this.matchLike(plan.singleChars, limit * 3));
    }

    if (mode === 'auto' && hits.length < limit && plan.relaxed && plan.relaxed !== plan.fts) {
      collect(this.matchFts(plan.relaxed, limit * 3));
    }

    return hits.slice(0, limit);
  }

  private matchFts(expression: string, limit: number): ChunkRow[] {
    const sql = `
      SELECT c.id, c.doc_key, c.page_no, c.text, c.meta, bm25(chunks_fts) AS score
      FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
      WHERE chunks_fts MATCH ?
      ORDER BY score
      LIMIT ?`;
    return this.db.prepare(sql).all(expression, limit) as unknown as ChunkRow[];
  }

  private matchLike(chars: string[], limit: number): ChunkRow[] {
    const where = chars.map(() => 'text LIKE ?').join(' AND ');
    const sql = `SELECT id, doc_key, page_no, text, meta, 0 AS score FROM chunks WHERE ${where} LIMIT ?`;
    return this.db
      .prepare(sql)
      .all(...chars.map((ch) => `%${ch}%`), limit) as unknown as ChunkRow[];
  }

  private toHit(row: ChunkRow, terms: string[], anchors: string[] = []): SearchHit {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(row.meta) as Record<string, unknown>;
    } catch {
      meta = {};
    }
    return {
      docKey: row.doc_key,
      page: row.page_no,
      text: row.text,
      meta,
      score: row.score,
      snippet: makeSnippet(row.text, terms, { anchors }),
    };
  }

  stats(): StoreStats {
    const row = this.db
      .prepare('SELECT COUNT(*) AS chunks, COUNT(DISTINCT doc_key) AS documents FROM chunks')
      .get() as { chunks: number; documents: number };
    return { chunks: Number(row.chunks), documents: Number(row.documents) };
  }

  close(): void {
    this.db.close();
  }
}