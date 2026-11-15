import { dayString } from '../text.js';
import type { FetchLike, PaperSource, RawPaper } from '../types.js';

/**
 * bioRxiv / medRxiv 官方 API（无需 key）。
 * 文档：https://api.biorxiv.org/
 * `GET /details/{server}/{from}/{to}/{cursor}` 返回一页（默认 100 条）。
 */
export interface BiorxivRow {
  doi?: string;
  title?: string;
  authors?: string;
  date?: string;
  abstract?: string;
  category?: string;
  version?: string;
}

export function biorxivUrl(server: PaperSource, days: number, now: Date, cursor = 0): string {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return `https://api.biorxiv.org/details/${server}/${dayString(from)}/${dayString(now)}/${cursor}`;
}

/** authors 字段是「A; B; C」这种分号串。 */
export function splitAuthors(authors: string | undefined): string[] {
  if (authors === undefined) return [];
  return authors
    .split(/[;；]/)
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

export function parseBiorxivRows(rows: BiorxivRow[], server: PaperSource, now = new Date()): RawPaper[] {
  const papers: RawPaper[] = [];
  for (const row of rows) {
    const doi = row.doi?.trim();
    const title = row.title?.replace(/\s+/g, ' ').trim();
    if (doi === undefined || doi === '' || title === undefined || title === '') continue;
    const created = row.date === undefined ? now : new Date(row.date);
    papers.push({
      id: `${server}:${doi}`,
      source: server,
      title,
      abstract: row.abstract?.replace(/\s+/g, ' ').trim() ?? '',
      authors: splitAuthors(row.authors),
      publishedAt: (Number.isNaN(created.getTime()) ? now : created).toISOString(),
      url: `https://www.${server}.org/content/${doi}v${row.version ?? '1'}`,
      doi,
    });
  }
  return papers;
}

export async function fetchBiorxiv(
  fetcher: FetchLike,
  options: { server: 'biorxiv' | 'medrxiv'; days: number; maxResults: number; signal?: AbortSignal; now?: Date },
): Promise<RawPaper[]> {
  const now = options.now ?? new Date();
  const url = biorxivUrl(options.server, options.days, now);
  const response = await fetcher(url, {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${options.server} 返回 HTTP ${response.status}`);
  const payload = (await response.json()) as { collection?: BiorxivRow[] };
  return parseBiorxivRows(payload.collection ?? [], options.server, now).slice(0, options.maxResults);
}