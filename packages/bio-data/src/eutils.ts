import type { EutilsIdentity, FetchLike } from './types.js';

/**
 * NCBI E-utilities 公共约定：
 * - 不带 key 时限速 3 次/秒，带 `tool` / `email` 表明身份是官方要求；
 * - `esearch` 返回 idlist，`esummary` 再按 id 拿元数据；
 * - 失败一律抛带上下文的 Error，由上层决定要不要降级。
 */
export const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

function identityQuery(identity: EutilsIdentity): string {
  const params: string[] = [];
  if (identity.tool !== undefined) params.push(`tool=${encodeURIComponent(identity.tool)}`);
  if (identity.email !== undefined) params.push(`email=${encodeURIComponent(identity.email)}`);
  return params.length === 0 ? '' : `&${params.join('&')}`;
}

export function esearchUrl(db: string, term: string, retmax: number, identity: EutilsIdentity = {}): string {
  return `${EUTILS_BASE}/esearch.fcgi?db=${encodeURIComponent(db)}&retmode=json&retmax=${retmax}&term=${encodeURIComponent(term)}${identityQuery(identity)}`;
}

export function esummaryUrl(db: string, ids: string[], identity: EutilsIdentity = {}): string {
  return `${EUTILS_BASE}/esummary.fcgi?db=${encodeURIComponent(db)}&retmode=json&id=${ids.join(',')}${identityQuery(identity)}`;
}

export function parseIds(payload: unknown): string[] {
  const result = (payload as { esearchresult?: { idlist?: unknown } } | null)?.esearchresult?.idlist;
  return Array.isArray(result) ? result.filter((item): item is string => typeof item === 'string') : [];
}

export function parseCount(payload: unknown): number {
  const raw = (payload as { esearchresult?: { count?: unknown } } | null)?.esearchresult?.count;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** esearch → 返回 id 列表与总命中数。 */
export async function runEsearch(
  fetcher: FetchLike,
  db: string,
  term: string,
  retmax: number,
  identity: EutilsIdentity,
  signal?: AbortSignal,
): Promise<{ ids: string[]; count: number }> {
  const response = await fetcher(esearchUrl(db, term, retmax, identity), {
    headers: { accept: 'application/json' },
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new Error(`${db} 的 esearch 返回 HTTP ${response.status}`);
  const payload = await response.json();
  return { ids: parseIds(payload), count: parseCount(payload) };
}

/** esummary → 原始 payload，交给各解析器。 */
export async function runEsummary(
  fetcher: FetchLike,
  db: string,
  ids: string[],
  identity: EutilsIdentity,
  signal?: AbortSignal,
): Promise<unknown> {
  if (ids.length === 0) return { result: {} };
  const response = await fetcher(esummaryUrl(db, ids, identity), {
    headers: { accept: 'application/json' },
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new Error(`${db} 的 esummary 返回 HTTP ${response.status}`);
  return response.json();
}

/** esummary 里每个条目的错误形如 `{ error: "cannot get document summary" }`。 */
export function isErrorEntry(entry: unknown): boolean {
  return typeof entry === 'object' && entry !== null && typeof (entry as { error?: unknown }).error === 'string';
}

/** 取 esummary result 下的条目数组（首项是 uids）。 */
export function summaryEntries(payload: unknown): Array<{ uid: string; entry: Record<string, unknown> }> {
  const result = (payload as { result?: Record<string, unknown> } | null)?.result;
  if (result === undefined || result === null) return [];
  const uids = Array.isArray(result['uids']) ? result['uids'].filter((uid): uid is string => typeof uid === 'string') : [];
  const entries: Array<{ uid: string; entry: Record<string, unknown> }> = [];
  for (const uid of uids) {
    const entry = result[uid];
    if (isErrorEntry(entry) || typeof entry !== 'object' || entry === null) continue;
    entries.push({ uid, entry: entry as Record<string, unknown> });
  }
  return entries;
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

export function strArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}