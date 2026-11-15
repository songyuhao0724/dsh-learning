import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  attachFiles,
  getItem,
  listAttachments,
  listItems,
  openZoteroDb,
  resolveAttachmentPath,
  summarize,
  type ZoteroHandle,
} from '../src/zotero.js';
import { createZoteroFixture, type ZoteroFixture } from './fixtures/zotero-fixture.js';

describe('Zotero 只读适配层', () => {
  let fixture: ZoteroFixture;
  let handle: ZoteroHandle;

  beforeEach(() => {
    fixture = createZoteroFixture();
    handle = openZoteroDb(fixture.dbPath);
  });

  afterEach(() => {
    handle?.close();
  });

  it('打开存在的库，默认不是副本', () => {
    expect(handle.isCopy).toBe(false);
    expect(handle.path).toBe(fixture.dbPath);
  });

  it('库不存在时给出明确错误', () => {
    expect(() => openZoteroDb(join(fixture.dataDir, 'nope.sqlite'))).toThrow(/不存在/);
  });

  it('只返回文献条目，跳过 note 与回收站', () => {
    const items = listItems(handle);
    expect(items.map((i) => i.key)).toEqual(['BBBB2222', 'AAAA1111']); // 按 dateAdded 倒序
  });

  it('字段、作者、分类、标签都被正确还原', () => {
    const item = getItem(handle, 'AAAA1111');
    expect(item).not.toBeNull();
    expect(item?.itemType).toBe('journalArticle');
    expect(item?.title).toBe('卷积神经网络在康复评估中的应用');
    expect(item?.abstract).toContain('深度学习');
    expect(item?.date).toBe('2025-06-01');
    expect(item?.publication).toBe('中国康复医学杂志');
    expect(item?.doi).toBe('10.1234/cjrm.2025.001');
    expect(item?.url).toBe('https://example.org/paper-a');
    expect(item?.creators).toEqual([
      { name: '张, 三', role: 'author' },
      { name: 'Smith, John', role: 'author' },
    ]);
    expect(item?.collections).toEqual(['康复与脑科学']);
    expect(item?.tags).toEqual(['深度学习']);
  });

  it('按 itemID 也能查到；查不到返回 null', () => {
    expect(getItem(handle, 2)?.key).toBe('BBBB2222');
    expect(getItem(handle, 'NOT-EXIST')).toBeNull();
  });

  it('summarize 给出库概况', () => {
    expect(summarize(handle)).toEqual({
      items: 2,
      attachments: 3,
      collections: 1,
      byType: { book: 1, journalArticle: 1 },
    });
  });

  it('imported_file 附件解析到 storage/<key>/<file>', () => {
    const attachments = listAttachments(handle, 1, fixture.dataDir);
    const stored = attachments.find((a) => a.linkMode === 0);
    expect(stored?.filePath).toBe(fixture.paperPath);
    expect(existsSync(stored?.filePath as string)).toBe(true);
  });

  it('linked_file 附件保留绝对路径；linked_url 没有本地文件', () => {
    const attachments = listAttachments(handle, 1, fixture.dataDir);
    const linked = attachments.find((a) => a.linkMode === 2);
    expect(linked?.filePath).toBe(fixture.localPdfPath);

    const urlOnly = listAttachments(handle, 2, fixture.dataDir);
    expect(urlOnly[0]?.linkMode).toBe(3);
    expect(urlOnly[0]?.filePath).toBeNull();
  });

  it('attachFiles 批量补附件', () => {
    const items = attachFiles(handle, listItems(handle), fixture.dataDir);
    const a = items.find((i) => i.key === 'AAAA1111');
    expect(a?.attachments).toHaveLength(2);
  });

  it('resolveAttachmentPath 缺路径时返回 null', () => {
    expect(resolveAttachmentPath({ key: 'X', linkMode: 0, rawPath: null }, fixture.dataDir)).toBeNull();
  });

  it('库被独占锁定时退化为读副本', () => {
    const lock = new DatabaseSync(fixture.dbPath);
    lock.exec('PRAGMA locking_mode = EXCLUSIVE');
    lock.exec('BEGIN EXCLUSIVE');
    let copyHandle: ZoteroHandle | undefined;
    try {
      copyHandle = openZoteroDb(fixture.dbPath);
      expect(copyHandle.isCopy).toBe(true);
      expect(listItems(copyHandle)).toHaveLength(2);
    } finally {
      copyHandle?.close();
      lock.exec('ROLLBACK');
      lock.close();
    }
  });
});