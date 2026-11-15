import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

/** 一页 PDF 的纯文本。 */
export interface PdfPage {
  /** 1 起的页码，用于生成「第 N 页」引用。 */
  page: number;
  text: string;
}

export interface PdfExtractOptions {
  /** 只取前 N 页（用于超大文献的快速预览）。 */
  maxPages?: number;
  /** 每页少于此字符数视为「空白页/坏页」，默认 20。 */
  minCharsPerPage?: number;
}

/**
 * 把 PDF 抽成「页 → 文本」。
 *
 * 输入可以是文件路径或已读入的字节（调用方自己负责下载/读取，
 * 本模块不发起任何网络请求）。
 */
export async function extractPdfPages(
  input: string | Uint8Array,
  options: PdfExtractOptions = {},
): Promise<PdfPage[]> {
  const { maxPages, minCharsPerPage = 20 } = options;
  // pdf.js 会把传入的 ArrayBuffer 转移（detach）给 worker，调用方的字节会失效；
  // 这里先复制一份，保证同一份字节可以被多次抽取，也不会弄坏调用方的缓冲区。
  const bytes =
    typeof input === 'string'
      ? new Uint8Array(await readFile(input))
      : Uint8Array.from(input);
  if (bytes.byteLength === 0) throw new Error('PDF 内容是空的（0 字节）');
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: false });
  const pages: PdfPage[] = [];
  for (let i = 0; i < text.length; i++) {
    if (maxPages !== undefined && pages.length >= maxPages) break;
    const normalized = normalizePdfText(text[i] ?? '');
    if (normalized.length < minCharsPerPage) continue;
    pages.push({ page: i + 1, text: normalized });
  }
  return pages;
}

/** 抽全部文本（页之间用两个换行分隔）。 */
export async function extractPdfText(
  input: string | Uint8Array,
  options: PdfExtractOptions = {},
): Promise<string> {
  const pages = await extractPdfPages(input, options);
  return pages.map((p) => p.text).join('\n\n');
}

/**
 * 规整 PDF 抽出的原始文本：
 * - 去软连字符（U+00AD）
 * - 跨行拆分的英文单词「reha-\nbilitation」拼回去
 * - 单个换行变空格、连续空白折叠
 * - 去掉行首孤立的页码
 */
export function normalizePdfText(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n').replace(/\u00ad/g, '');
  text = text.replace(/([A-Za-z])-\n\s*([a-z])/g, '$1$2');
  const lines = text.split('\n').map((line) => line.replace(/[ \t\u3000]+/g, ' ').trim());
  const kept = lines.filter((line) => !/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(line));
  text = kept.join('\n');
  text = text.replace(/\n{2,}/g, '\n\n').replace(/[ \t]*\n[ \t]*/g, ' ');
  return text.replace(/\s{2,}/g, ' ').trim();
}

/**
 * 判断这批页是否像扫描件（抽不出文字）。
 * 扫描件需要 OCR，本仓库 v1 不做 OCR，只给出明确提示。
 */
export function looksScanned(pages: PdfPage[], totalPages?: number): boolean {
  const pagesWithText = pages.length;
  const expected = totalPages ?? pagesWithText;
  if (expected === 0) return false;
  const chars = pages.reduce((sum, p) => sum + p.text.length, 0);
  return chars / expected < 50;
}