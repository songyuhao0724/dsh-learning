import { dayString, isoDate, plainText, xmlTag, xmlTags } from '../text.js';
import type { FetchLike, RawPaper } from '../types.js';

/**
 * arXiv Atom API。
 * 文档：https://info.arxiv.org/help/api/user-manual.html
 * 我们只取 recent 的 q-bio / 医学信息相关分类，不写检索式再造轮子。
 */
export const ARXIV_CATEGORIES = ['q-bio.QM', 'q-bio.GN', 'q-bio.NC', 'cs.LG'];

export function arxivUrl(options: { maxResults: number; categories?: string[]; query?: string }): string {
  const categories = options.categories ?? ARXIV_CATEGORIES;
  const search = options.query === undefined
    ? categories.map((category) => `cat:${category}`).join('+OR+')
    : `all:${encodeURIComponent(options.query)}`;
  return `https://export.arxiv.org/api/query?search_query=${search}&sortBy=submittedDate&sortOrder=descending&max_results=${options.maxResults}`;
}

export function parseArxivFeed(xml: string, now = new Date()): RawPaper[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1] ?? '');
  const papers: RawPaper[] = [];
  for (const entry of entries) {
    const rawId = xmlTag(entry, 'id') ?? '';
    const nativeId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '').trim();
    if (nativeId === '') continue;
    const title = plainText(xmlTag(entry, 'title') ?? '');
    if (title === '') continue;
    const authors = xmlTags(entry, 'name').map((name) => plainText(name)).filter((name) => name !== '');
    const doi = xmlTag(entry, 'doi');
    papers.push({
      id: `arxiv:${nativeId}`,
      source: 'arxiv',
      title,
      abstract: plainText(xmlTag(entry, 'summary') ?? ''),
      authors,
      publishedAt: isoDate(xmlTag(entry, 'published'), now),
      url: `https://arxiv.org/abs/${nativeId}`,
      ...(doi === undefined ? {} : { doi: plainText(doi) }),
    });
  }
  return papers;
}

export async function fetchArxiv(
  fetcher: FetchLike,
  options: { maxResults: number; query?: string; signal?: AbortSignal; now?: Date },
): Promise<RawPaper[]> {
  const response = await fetcher(arxivUrl({ maxResults: options.maxResults, query: options.query }), {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    headers: { accept: 'application/atom+xml' },
  });
  if (!response.ok) throw new Error(`arXiv 返回 HTTP ${response.status}`);
  return parseArxivFeed(await response.text(), options.now);
}

/** 供测试与文档引用：把「最近 N 天」算成 arXiv 的 submittedDate 检索式（可选增强，当前不默认启用）。 */
export function arxivDateRange(days: number, now = new Date()): { from: string; to: string } {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: dayString(from), to: dayString(now) };
}