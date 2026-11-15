import { runEsearch, runEsummary, str, summaryEntries } from './eutils.js';
import type { BioSearchResult, FetchLike, SearchOptions, SraStudy } from './types.js';

const DEFAULT_MAX = 10;

/** SRA 检索页；按 accession 搜能直接落到该研究。 */
export function sraUrl(accession: string): string {
  return `https://www.ncbi.nlm.nih.gov/sra/?term=${encodeURIComponent(accession)}`;
}

/**
 * SRA 的 esummary 只返回一个 `expxml` 字符串（形如
 * `<Summary><Title>…</Title><Platform …/><Study acc="SRP123"/><Organism taxid="9606" ScientificName="Homo sapiens"/></Summary>`），
 * 外加 `<Runs><Run acc="SRR…" …/></Runs>`，没有结构化字段，只能按标签取。
 */
export function parseSraSummary(payload: unknown): SraStudy[] {
  const studies: SraStudy[] = [];
  for (const { uid, entry } of summaryEntries(payload)) {
    const xml = str(entry['expxml']) ?? '';
    const accession = /<Study\s+acc="([^"]+)"/.exec(xml)?.[1] ?? uid;
    const title = /<Title>([\s\S]*?)<\/Title>/.exec(xml)?.[1]?.replace(/\s+/g, ' ').trim() ?? '(无标题)';
    const organism = /ScientificName="([^"]+)"/.exec(xml)?.[1];
    const runs = (xml.match(/<Run\s/g) ?? []).length;
    studies.push({
      accession,
      title,
      ...(organism === undefined ? {} : { organism }),
      runs,
      url: sraUrl(accession),
    });
  }
  return studies;
}

/** 检索 SRA 研究（SRP 级别）。命中常常是几万条，所以默认只取 10 条并回报总数。 */
export async function searchSra(options: SearchOptions & { fetch: FetchLike }): Promise<BioSearchResult<SraStudy>> {
  const maxResults = options.maxResults ?? DEFAULT_MAX;
  const identity = options.identity ?? { tool: 'dsh-learning' };
  const warnings: string[] = [];
  const { ids, count } = await runEsearch(options.fetch, 'sra', options.term, maxResults, identity, options.signal);
  if (ids.length === 0) {
    return { source: 'sra', query: options.term, count, items: [], warnings: ['没有命中 SRA 研究。'] };
  }
  const items = parseSraSummary(await runEsummary(options.fetch, 'sra', ids, identity, options.signal));
  if (count > items.length) warnings.push(`共命中 ${count} 条，这里只列前 ${items.length} 条；把关键词写得更具体能缩到可读范围。`);
  return { source: 'sra', query: options.term, count, items, warnings };
}