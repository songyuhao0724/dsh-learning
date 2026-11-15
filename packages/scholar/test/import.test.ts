import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  documentMeta,
  importZoteroLibrary,
  indexPdfFile,
  pagesToChunks,
  pickPdf,
} from '../src/import.js';
import { ScholarStore } from '../src/store.js';
import { createZoteroFixture, type ZoteroFixture } from './fixtures/zotero-fixture.js';
import { buildTextPdf } from './fixtures/make-pdf.js';

const PAPER = buildTextPdf([
  {
    lines: [
      'Convolutional neural networks for stroke rehabilitation',
      'Abstract: We evaluate a CNN pipeline on 1,204 EEG records.',
    ],
  },
  {
    lines: ['Methods', 'Signals were band-pass filtered between 1 and 45 Hz.', 'AUC reached 0.91.'],
  },
]);

let workDir: string;
let store: ScholarStore;
let fixture: ZoteroFixture;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'dsh-import-test-'));
  store = new ScholarStore(join(workDir, 'index.db'));
  fixture = createZoteroFixture({ paperPdf: PAPER });
});

afterEach(() => {
  store.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('Zotero → 索引 端到端', () => {
  it('带 PDF 的文献入库，没有 PDF 的被跳过', async () => {
    const result = await importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
    });
    expect(result.documents).toBe(1);
    expect(result.pages).toBe(2);
    expect(result.skipped).toEqual([
      { key: 'BBBB2222', title: '康复工程导论', reason: 'no-pdf' },
    ]);
  });

  it('检索命中并带出页码、标题、作者、年份、DOI', () => {
    return importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
    }).then(() => {
      const hits = store.search('rehabilitation');
      expect(hits).toHaveLength(1);
      const hit = hits[0]!;
      expect(hit.docKey).toBe('AAAA1111');
      expect(hit.page).toBe(1);
      expect(hit.meta.title).toBe('卷积神经网络在康复评估中的应用');
      expect(hit.meta.authors).toEqual(['张, 三', 'Smith, John']);
      expect(hit.meta.year).toBe(2025);
      expect(hit.meta.doi).toBe('10.1234/cjrm.2025.001');
      expect(hit.snippet).toContain('[rehabilitation]');
    });
  });

  it('第 2 页的内容也能被检索到（引用精确到页）', async () => {
    await importZoteroLibrary({ dbPath: fixture.dbPath, dataDir: fixture.dataDir, store });
    const hits = store.search('band-pass');
    expect(hits[0]?.page).toBe(2);
  });

  it('重复导入是幂等的', async () => {
    await importZoteroLibrary({ dbPath: fixture.dbPath, dataDir: fixture.dataDir, store });
    await importZoteroLibrary({ dbPath: fixture.dbPath, dataDir: fixture.dataDir, store });
    expect(store.stats()).toEqual({ chunks: 2, documents: 1 });
  });

  it('损坏的 PDF 记为 error 而不是中断整个导入', async () => {
    writeFileSync(fixture.paperPath, Buffer.from('not a pdf at all'));
    const result = await importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
    });
    expect(result.documents).toBe(0);
    expect(result.skipped.map((s) => s.reason)).toContain('error');
  });

  it('进度回调按条目上报', async () => {
    const events: string[] = [];
    await importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
      onProgress: (e) => events.push(`${e.index}/${e.total}:${e.status}`),
    });
    // listItems 按 dateAdded 倒序：先书（无 PDF），后论文（有 PDF）
    expect(events).toEqual(['1/2:no-pdf', '2/2:indexed']);
  });
});

describe('辅助函数', () => {
  it('pagesToChunks 每页一条', () => {
    const chunks = pagesToChunks('K1', [
      { page: 1, text: 'a' },
      { page: 3, text: 'b' },
    ]);
    expect(chunks).toEqual([
      { docKey: 'K1', page: 1, text: 'a', meta: {} },
      { docKey: 'K1', page: 3, text: 'b', meta: {} },
    ]);
  });

  it('documentMeta 提取作者/年份/DOI，缺日期时年份为 null', () => {
    const meta = documentMeta({
      itemId: 1,
      key: 'K1',
      itemType: 'journalArticle',
      title: 'T',
      abstract: null,
      date: 'n.d.',
      publication: null,
      doi: null,
      url: null,
      creators: [
        { name: 'A, B', role: 'author' },
        { name: 'E, F', role: 'editor' },
      ],
      collections: [],
      tags: [],
      attachments: [],
    });
    expect(meta.authors).toEqual(['A, B']);
    expect(meta.year).toBeNull();
  });

  it('pickPdf 跳过不存在的文件', async () => {
    const { listItems, attachFiles, openZoteroDb } = await import('../src/zotero.js');
    const handle = openZoteroDb(fixture.dbPath);
    const items = attachFiles(handle, listItems(handle), fixture.dataDir);
    handle.close();
    const first = items.find((i) => i.key === 'AAAA1111')!;
    expect(pickPdf(first)?.filePath).toBe(fixture.paperPath);
  });
});

describe('Zotero 全文缓存兜底', () => {
  it('PDF 损坏时退回缓存，仍能按页入库', async () => {
    writeFileSync(fixture.paperPath, Buffer.from('broken pdf'));
    mkdirSync(join(fixture.dataDir, 'storage', 'ATTACH01'), { recursive: true });
    writeFileSync(
      join(fixture.dataDir, 'storage', 'ATTACH01', '.zotero-ft-cache'),
      'cached page one about stroke\fcached page two',
    );
    const result = await importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
    });
    expect(result.documents).toBe(1);
    expect(result.pages).toBe(2);
    const hits = store.search('cached');
    expect(hits[0]?.meta.indexedFrom).toBe('zotero-cache');
  });

  it('没有 PDF 但有缓存也能入库（Zotero 已抽过文的条目）', async () => {
    const storageDir = join(fixture.dataDir, 'storage', 'ATTACH03');
    mkdirSync(storageDir, { recursive: true });
    writeFileSync(join(storageDir, '.zotero-ft-cache'), '康复工程 导论 第一章 绪论');
    const result = await importZoteroLibrary({
      dbPath: fixture.dbPath,
      dataDir: fixture.dataDir,
      store,
    });
    expect(result.documents).toBe(2); // 论文（PDF）+ 书（仅缓存）
    const hits = store.search('绪论');
    expect(hits[0]?.docKey).toBe('BBBB2222');
  });
});

describe('indexPdfFile', () => {
  it('给单个本地 PDF 建索引', async () => {
    const file = join(workDir, 'manual.pdf');
    writeFileSync(file, PAPER);
    const { pages } = await indexPdfFile(store, {
      filePath: file,
      meta: { title: '手动导入的论文' },
    });
    expect(pages).toBe(2);
    const hits = store.search('stroke');
    expect(hits[0]?.meta.title).toBe('手动导入的论文');
  });

  it('抽不出文字时抛错并说明原因', async () => {
    const file = join(workDir, 'broken.pdf');
    writeFileSync(file, Buffer.from('nope'));
    await expect(indexPdfFile(store, { filePath: file })).rejects.toThrow();
  });
});