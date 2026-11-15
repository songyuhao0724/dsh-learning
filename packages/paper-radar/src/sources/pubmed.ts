import type { FetchLike, RawPaper } from '../types.js';

/**
 * PubMed E-utilities（无需 key，但 NCBI 要求带上 tool/email 表明身份并限速 ≤3 req/s）。
 * 两步：esearch 拿 PMID 列表 → esummary 拿元数据。
 */
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface EutilsIdentity {
  tool?: string;
  email?: string;
}

function identityQuery(identity: EutilsIdentity): string {
  const params: string[] = [];
  if (identity.tool !== undefined) params.push(`tool=${encodeURIComponent(identity.tool)}`);
  if (identity.email !== undefined) params.push(`email=${encodeURIComponent(identity.email)}`);
  return params.length === 0 ? '' : `&${params.join('&')}`;
}

export function pubmedSearchUrl(term: string, retmax: number, identity: EutilsIdentity = {}): string {
  return `${BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=date&retmax=${retmax}&term=${encodeURIComponent(term)}${identityQuery(identity)}`;
}

export function pubmedSummaryUrl(ids: string[], identity: EutilsIdentity = {}): string {
  return `${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}${identityQuery(identity)}`;
}

export function parsePubmedIds(payload: unknown): string[] {
  const result = (payload as { esearchresult?: { idlist?: unknown } } | null)?.esearchresult?.idlist;
  return Array.isArray(result) ? result.filter((item): item is string => typeof item === 'string') : [];
}

interface SummaryEntry {
  title?: string;
  pubdate?: string;
  authors?: Array<{ name?: string }>;
  articleids?: Array<{ idtype?: string; value?: string }>;
  source?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * PubMed 的 pubdate 是「2026 Jan 5」「2026 Jan-Feb」「2026」这类，尽量解析，失败就用 fallback。
 * 注意：不能直接丢给 `new Date()` —— 「2026 Jan 4」会被当成**本地时区**解析，东八区下 UTC 日期变成 01-03，故手工拼 UTC。
 */
export function parsePubmedDate(value: string | undefined, fallback = new Date()): string {
  if (value === undefined || value.trim() === '') return fallback.toISOString();
  const text = value.trim();

  const full = /^(\d{4})\s+([A-Za-z]{3})[A-Za-z]*\s*[-–/]?\s*(?:[A-Za-z]{3}[A-Za-z]*)?\s*(\d{1,2})/.exec(text);
  if (full?.[1] !== undefined && full[2] !== undefined && full[3] !== undefined) {
    const month = MONTHS[full[2].toLowerCase()];
    if (month !== undefined) {
      const stamp = Date.UTC(Number(full[1]), month - 1, Number(full[3]));
      if (!Number.isNaN(stamp)) return new Date(stamp).toISOString();
    }
  }

  const yearMonth = /^(\d{4})\s+([A-Za-z]{3})/.exec(text);
  if (yearMonth?.[1] !== undefined && yearMonth[2] !== undefined) {
    const month = MONTHS[yearMonth[2].toLowerCase()];
    if (month !== undefined) return new Date(Date.UTC(Number(yearMonth[1]), month - 1, 1)).toISOString();
  }

  const yearOnly = /^(\d{4})/.exec(text);
  if (yearOnly?.[1] !== undefined) return new Date(Date.UTC(Number(yearOnly[1]), 0, 1)).toISOString();

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return fallback.toISOString();
}

export function parsePubmedSummary(payload: unknown, now = new Date()): RawPaper[] {
  const result = (payload as { result?: Record<string, unknown> } | null)?.result;
  if (result === undefined) return [];
  const uids = Array.isArray(result['uids']) ? result['uids'].filter((uid): uid is string => typeof uid === 'string') : [];
  const papers: RawPaper[] = [];
  for (const uid of uids) {
    const entry = result[uid] as SummaryEntry | undefined;
    const title = entry?.title?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (entry === undefined || title === undefined || title === '') continue;
    const doi = entry.articleids?.find((item) => item.idtype === 'doi')?.value;
    papers.push({
      id: `pubmed:${uid}`,
      source: 'pubmed',
      title,
      abstract: '',
      authors: (entry.authors ?? []).map((author) => author.name ?? '').filter((name) => name !== ''),
      publishedAt: parsePubmedDate(entry.pubdate, now),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
      ...(doi === undefined ? {} : { doi }),
    });
  }
  return papers;
}

export async function fetchPubmed(
  fetcher: FetchLike,
  options: { term: string; maxResults: number; identity?: EutilsIdentity; signal?: AbortSignal; now?: Date },
): Promise<RawPaper[]> {
  const identity = options.identity ?? {};
  const searchResponse = await fetcher(pubmedSearchUrl(options.term, options.maxResults, identity), {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    headers: { accept: 'application/json' },
  });
  if (!searchResponse.ok) throw new Error(`PubMed esearch 返回 HTTP ${searchResponse.status}`);
  const ids = parsePubmedIds(await searchResponse.json());
  if (ids.length === 0) return [];

  const summaryResponse = await fetcher(pubmedSummaryUrl(ids, identity), {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    headers: { accept: 'application/json' },
  });
  if (!summaryResponse.ok) throw new Error(`PubMed esummary 返回 HTTP ${summaryResponse.status}`);
  return parsePubmedSummary(await summaryResponse.json(), options.now);
}