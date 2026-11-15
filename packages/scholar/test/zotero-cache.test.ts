import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readZoteroCache, zoteroCachePath } from '../src/zotero-cache.js';

const dirs: string[] = [];

function makeDataDir(attachmentKeys: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'zotero-cache-'));
  dirs.push(dir);
  for (const key of attachmentKeys) mkdirSync(join(dir, 'storage', key), { recursive: true });
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Zotero 全文缓存', () => {
  it('缓存路径遵循 storage/<附件 key>/.zotero-ft-cache', () => {
    expect(zoteroCachePath('D:/zotero', 'AAAA1111')).toBe(
      join('D:/zotero', 'storage', 'AAAA1111', '.zotero-ft-cache'),
    );
  });

  it('用换页符 \\f 分页，并规整每页文本', () => {
    const dataDir = makeDataDir(['ATTACH01']);
    writeFileSync(
      join(dataDir, 'storage', 'ATTACH01', '.zotero-ft-cache'),
      '第一页   正文\n12\n\f第二页 reha-\nbilitation',
    );
    const result = readZoteroCache(dataDir, 'ATTACH01');
    expect(result?.attachmentKey).toBe('ATTACH01');
    expect(result?.pages).toEqual([
      { page: 1, text: '第一页 正文' }, // 行首的「12」被当作页码丢掉
      { page: 2, text: '第二页 rehabilitation' },
    ]);
  });

  it('空页被跳过但页码保持原样', () => {
    const dataDir = makeDataDir(['ATTACH02']);
    writeFileSync(join(dataDir, 'storage', 'ATTACH02', '.zotero-ft-cache'), 'p1\f\fp3');
    const result = readZoteroCache(dataDir, 'ATTACH02');
    expect(result?.pages).toEqual([
      { page: 1, text: 'p1' },
      { page: 3, text: 'p3' },
    ]);
  });

  it('文件不存在或内容为空时返回 null', () => {
    const dataDir = makeDataDir(['ATTACH03']);
    expect(readZoteroCache(dataDir, 'NOPE')).toBeNull();
    writeFileSync(join(dataDir, 'storage', 'ATTACH03', '.zotero-ft-cache'), '   \f  ');
    expect(readZoteroCache(dataDir, 'ATTACH03')).toBeNull();
  });
});