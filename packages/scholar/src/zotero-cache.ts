/**
 * 读 Zotero 自己的全文缓存。
 *
 * Zotero 在 `storage/<附件 key>/.zotero-ft-cache` 里存了一份 UTF-8 纯文本，
 * 用 `\f`（换页符）分页。这是**已抓取文件的副产物**，不是新下载，
 * 所以可以直接用：省掉一次 PDF 解析，而且扫描件只要 Zotero 做过 OCR 也能用。
 *
 * 注意：Zotero 只索引前 100 页（`fulltextItems.indexedPages`），
 * 所以缓存可能不完整；本函数不补全，只如实返回。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePdfText, type PdfPage } from './pdf.js';

export interface ZoteroCacheResult {
  pages: PdfPage[];
  /** 附件 key，便于在结果里标注来源。 */
  attachmentKey: string;
}

/** 缓存文件路径。 */
export function zoteroCachePath(dataDir: string, attachmentKey: string): string {
  return join(dataDir, 'storage', attachmentKey, '.zotero-ft-cache');
}

/**
 * 读取指定附件的全文缓存。
 *
 * @returns 分页文本；文件不存在或内容为空时返回 null。
 */
export function readZoteroCache(dataDir: string, attachmentKey: string): ZoteroCacheResult | null {
  const path = zoteroCachePath(dataDir, attachmentKey);
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  if (raw.trim() === '') return null;
  const pages: PdfPage[] = [];
  raw.split('\f').forEach((part, index) => {
    const text = normalizePdfText(part);
    if (text.length > 0) pages.push({ page: index + 1, text });
  });
  return pages.length > 0 ? { pages, attachmentKey } : null;
}