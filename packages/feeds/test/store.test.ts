import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FeedStore } from '../src/store.js';
import type { RawFeedItem } from '../src/types.js';

const dir = mkdtempSync(join(tmpdir(), 'dsh-feeds-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function item(overrides: Partial<RawFeedItem> = {}): RawFeedItem {
  return {
    id: 'a1',
    sourceId: 'nature-methods',
    title: 'Single-cell spatial atlas',
    summary: 'A spatial atlas of 1.2 million cells.',
    url: 'https://example.org/a1',
    publishedAt: '2026-11-17T10:00:00.000Z',
    topics: ['方法学'],
    ...overrides,
  };
}

describe('FeedStore', () => {
  it('写入、去重、按时间倒序', () => {
    const store = new FeedStore(join(dir, 'feeds.db'));
    try {
      expect(store.upsertMany([item(), item({ id: 'a2', title: 'Older', publishedAt: '2026-11-01T00:00:00.000Z' })], '2026-11-18T00:00:00.000Z')).toEqual({
        added: 2,
        skipped: 0,
      });
      const again = store.upsertMany([item()], '2026-11-19T00:00:00.000Z');
      expect(again).toEqual({ added: 0, skipped: 1 });
      const rows = store.search({ limit: 10 });
      expect(rows.map((row) => row.id)).toEqual(['a1', 'a2']);
      expect(store.stats().items).toBe(2);
      expect(store.stats().sources).toBe(1);
    } finally {
      store.close();
    }
  });

  it('按关键词、时间、主题过滤', () => {
    const store = new FeedStore(join(dir, 'filter.db'));
    try {
      store.upsertMany(
        [
          item(),
          item({ id: 'a2', title: 'Genome assembly', summary: 'Long reads for assembly.', topics: ['基因组学'] }),
          item({ id: 'a3', title: 'Old atlas', summary: 'Spatial atlas v0.', publishedAt: '2026-01-01T00:00:00.000Z' }),
        ],
        '2026-11-18T00:00:00.000Z',
      );
      expect(store.search({ query: 'spatial', limit: 10 }).map((row) => row.id)).toEqual(['a1', 'a3']);
      expect(store.search({ query: 'SPATIAL', limit: 10 })).toHaveLength(2);
      expect(store.search({ since: '2026-11-01', limit: 10 }).map((row) => row.id)).toEqual(['a1', 'a2']);
      expect(store.search({ topics: ['基因组学'], limit: 10 }).map((row) => row.id)).toEqual(['a2']);
      expect(store.search({ sourceIds: ['nature-methods'], query: 'atlas', limit: 1 })).toHaveLength(1);
      expect(store.search({ query: 'nothing-matches', limit: 10 })).toEqual([]);
    } finally {
      store.close();
    }
  });

  it('同一文件重开还在（累积不是快照）', () => {
    const file = join(dir, 'persist.db');
    const first = new FeedStore(file);
    first.upsertMany([item()], '2026-11-18T00:00:00.000Z');
    first.close();
    const second = new FeedStore(file);
    try {
      expect(second.stats().items).toBe(1);
    } finally {
      second.close();
    }
  });
});