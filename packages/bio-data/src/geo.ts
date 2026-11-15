import { num, runEsearch, runEsummary, str, strArray, summaryEntries } from './eutils.js';
import type { BioSearchResult, FetchLike, GeoDataset, SearchOptions } from './types.js';

const DEFAULT_MAX = 10;

/** GEO 数据集详情页；比 NCBI 的「所有结果」页更适合直接分享。 */
export function geoUrl(accession: string): string {
  return `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${encodeURIComponent(accession)}`;
}

/** 把 esummary 的原始条目转成 GeoDataset；没有 GSE 编号的条目丢弃（如平台/样本级条目）。 */
export function parseGeoSummary(payload: unknown): GeoDataset[] {
  const datasets: GeoDataset[] = [];
  for (const { entry } of summaryEntries(payload)) {
    const accession = str(entry['accession']) ?? str(entry['gse']);
    // 只有 GSE 编号才是「数据集」；GPL/GDS 级别的命中在 gds 库里也会出现，混进来会让列表失真。
    if (accession === undefined || !/^GSE\d+$/.test(accession)) continue;
    datasets.push({
      accession,
      title: str(entry['title']) ?? '(无标题)',
      summary: str(entry['summary']) ?? '',
      organism: str(entry['taxon']),
      studyType: str(entry['gdstype']),
      samples: num(entry['n_samples']),
      platform: str(entry['gpl']),
      pubmedIds: strArray(entry['pubmedids']),
      updatedAt: str(entry['pdat']),
      url: geoUrl(accession),
      ftp: str(entry['ftplink']),
      bioproject: str(entry['bioproject']),
    });
  }
  return datasets;
}

/**
 * 检索 GEO 数据集。`term` 支持 GEO 自己的字段语法，例如 `lung cancer AND "Homo sapiens"[Organism]`。
 */
export async function searchGeo(options: SearchOptions & { fetch: FetchLike }): Promise<BioSearchResult<GeoDataset>> {
  const maxResults = options.maxResults ?? DEFAULT_MAX;
  const identity = options.identity ?? { tool: 'dsh-learning' };
  const warnings: string[] = [];
  const { ids, count } = await runEsearch(options.fetch, 'gds', options.term, maxResults, identity, options.signal);
  if (ids.length === 0) {
    return { source: 'geo', query: options.term, count, items: [], warnings: ['没有命中 GEO 数据集，试着放宽关键词或去掉字段限定。'] };
  }
  const items = parseGeoSummary(await runEsummary(options.fetch, 'gds', ids, identity, options.signal));
  const missing = ids.length - items.length;
  if (missing > 0) warnings.push(`${missing} 条命中不是数据集级别（可能是平台或样本），已跳过。`);
  return { source: 'geo', query: options.term, count, items, warnings };
}