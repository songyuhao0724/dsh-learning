/**
 * Zotero 文献 → 本地全文索引。
 *
 * 边界（见仓库 COMPLIANCE.md）：本模块只读用户已经获得的本地 PDF 文件，
 * 不发起任何网络请求、不下载、不解密、不绕过任何访问控制。
 * 用户用 Zotero 官方 Connector 在自己浏览器里抓取的正文，落到 `storage/` 后
 * 由这里抽取文字并建索引。
 */
import { existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { extractPdfPages, looksScanned, type PdfExtractOptions, type PdfPage } from './pdf.js';
import { attachFiles, listItems, openZoteroDb, type ZoteroItem } from './zotero.js';
import type { ChunkInput, ScholarStore } from './store.js';

export type SkipReason = 'no-pdf' | 'no-text' | 'error';

export interface SkippedItem {
  key: string;
  title: string;
  reason: SkipReason;
  detail?: string;
}

export interface ImportProgress {
  index: number;
  total: number;
  key: string;
  title: string;
  status: 'indexed' | SkipReason;
}

export interface ImportOptions {
  /** `zotero.sqlite` 路径。 */
  dbPath: string;
  /** Zotero 的 data directory（含 `storage/`）。 */
  dataDir: string;
  store: ScholarStore;
  /** 最多处理多少条文献（按 dateAdded 倒序）。 */
  limit?: number;
  extract?: PdfExtractOptions;
  onProgress?: (event: ImportProgress) => void;
}

export interface ImportResult {
  /** 成功建索引的文献数。 */
  documents: number;
  /** 写入的页数（= 索引分块数）。 */
  pages: number;
  skipped: SkippedItem[];
}

/** 把一条 Zotero 文献的元数据整理成索引里要存的 meta。 */
export function documentMeta(item: ZoteroItem): Record<string, unknown> {
  const yearMatch = item.date?.match(/(\d{4})/);
  return {
    title: item.title ?? '',
    authors: item.creators.filter((c) => c.role === 'author').map((c) => c.name),
    year: yearMatch ? Number(yearMatch[1]) : null,
    doi: item.doi ?? null,
    publication: item.publication ?? null,
    itemType: item.itemType,
    zoteroKey: item.key,
    source: 'zotero',
  };
}

/** 挑出这篇文献里第一个可用的本地 PDF 附件。 */
export function pickPdf(item: ZoteroItem): { filePath: string } | null {
  for (const attachment of item.attachments) {
    if (attachment.filePath === null) continue;
    if (extname(attachment.filePath).toLowerCase() !== '.pdf') continue;
    if (!existsSync(attachment.filePath)) continue;
    if (statSync(attachment.filePath).size === 0) continue;
    return { filePath: attachment.filePath };
  }
  return null;
}

/** 把抽取出的页转成索引分块（每页一条，引用可精确到页）。 */
export function pagesToChunks(
  docKey: string,
  pages: PdfPage[],
  meta: Record<string, unknown> = {},
): ChunkInput[] {
  return pages.map((page) => ({ docKey, page: page.page, text: page.text, meta }));
}

/**
 * 给一篇已在本地的 PDF 建索引（不经过 Zotero）。
 * 用户手动下载的论文、课程讲义都可以用这个入口。
 */
export async function indexPdfFile(
  store: ScholarStore,
  options: {
    filePath: string;
    /** 默认用文件路径本身。 */
    docKey?: string;
    meta?: Record<string, unknown>;
    extract?: PdfExtractOptions;
  },
): Promise<{ docKey: string; pages: number }> {
  const docKey = options.docKey ?? options.filePath;
  const pages = await extractPdfPages(options.filePath, options.extract);
  if (pages.length === 0) throw new Error(`抽不出文字（可能是扫描件）：${options.filePath}`);
  store.removeDocument(docKey);
  store.upsertChunks(pagesToChunks(docKey, pages, options.meta ?? {}));
  return { docKey, pages: pages.length };
}

/**
 * 把 Zotero 库里所有带本地 PDF 的文献导入索引。
 *
 * 幂等：同一篇文献重复导入会先删旧索引再写入，不会重复累积。
 */
export async function importZoteroLibrary(options: ImportOptions): Promise<ImportResult> {
  const { dbPath, dataDir, store, limit = 500, extract, onProgress } = options;
  const handle = openZoteroDb(dbPath);
  const result: ImportResult = { documents: 0, pages: 0, skipped: [] };

  try {
    const items = attachFiles(handle, listItems(handle, limit), dataDir);
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as ZoteroItem;
      const title = item.title ?? '(无标题)';
      const report = (status: ImportProgress['status']): void => {
        onProgress?.({ index: i + 1, total, key: item.key, title, status });
      };

      const pdf = pickPdf(item);
      if (!pdf) {
        result.skipped.push({ key: item.key, title, reason: 'no-pdf' });
        report('no-pdf');
        continue;
      }

      try {
        const pages = await extractPdfPages(pdf.filePath, extract);
        if (pages.length === 0 || looksScanned(pages)) {
          result.skipped.push({
            key: item.key,
            title,
            reason: 'no-text',
            detail: '扫描件或文字层缺失，v1 不做 OCR',
          });
          report('no-text');
          continue;
        }
        const chunks = pagesToChunks(item.key, pages, documentMeta(item));
        store.removeDocument(item.key);
        store.upsertChunks(chunks);
        result.documents += 1;
        result.pages += chunks.length;
        report('indexed');
      } catch (error) {
        result.skipped.push({
          key: item.key,
          title,
          reason: 'error',
          detail: error instanceof Error ? error.message : String(error),
        });
        report('error');
      }
    }
  } finally {
    handle.close();
  }

  return result;
}