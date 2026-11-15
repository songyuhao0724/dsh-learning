import { fetchArxiv } from './sources/arxiv.js';
import { fetchBiorxiv } from './sources/biorxiv.js';
import { fetchPubmed } from './sources/pubmed.js';
import { detectTopics, resolveTopics } from './topics.js';
import type { FetchLike, RadarItem, RadarOptions } from './types.js';

export interface RadarResult {
  items: RadarItem[];
  warnings: string[];
  perSource: Record<string, number>;
}

const DEFAULT_FETCH: FetchLike = (input, init) => globalThis.fetch(input, init);

/**
 * 抓一轮热点：arXiv 永远抓；bioRxiv / medRxiv 抓最近 days 天；
 * 只有给了 query 才查 PubMed（避免无主题时把 PubMed 全库噪音拉进来）。
 */
export async function collectRadar(options: RadarOptions = {}): Promise<RadarResult> {
  const fetcher = options.fetch ?? DEFAULT_FETCH;
  const days = options.days ?? 7;
  const perSourceLimit = options.perSource ?? 25;
  const now = options.now ?? new Date();
  const query = options.query;
  const warnings: string[] = [];

  const jobs: Array<{ label: string; run: () => Promise<RadarItem[]> }> = [
    {
      label: 'arXiv',
      run: async () =>
        (await fetchArxiv(fetcher, { maxResults: perSourceLimit, ...(query === undefined ? {} : { query }), now })).map(tag),
    },
    {
      label: 'bioRxiv',
      run: async () =>
        (await fetchBiorxiv(fetcher, { server: 'biorxiv', days, maxResults: perSourceLimit, now })).map(tag),
    },
    {
      label: 'medRxiv',
      run: async () =>
        (await fetchBiorxiv(fetcher, { server: 'medrxiv', days, maxResults: perSourceLimit, now })).map(tag),
    },
  ];
  if (query !== undefined) {
    jobs.push({
      label: 'PubMed',
      run: async () =>
        (await fetchPubmed(fetcher, { term: query, maxResults: perSourceLimit, now })).map(tag),
    });
  }

  const settled = await Promise.allSettled(jobs.map(async (job) => ({ label: job.label, items: await job.run() })));
  const perSourceCount: Record<string, number> = {};
  const collected: RadarItem[] = [];
  settled.forEach((outcome, index) => {
    const label = jobs[index]?.label ?? `source-${index}`;
    if (outcome.status === 'fulfilled') {
      perSourceCount[label] = outcome.value.items.length;
      collected.push(...outcome.value.items);
    } else {
      perSourceCount[label] = 0;
      warnings.push(`${label} 抓取失败：${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
    }
  });

  const wanted = resolveTopics(options.topics);
  const deduped = dedupe(collected);
  const filtered = wanted === undefined ? deduped : deduped.filter((item) => item.topics.some((topic) => wanted.includes(topic)));
  filtered.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));

  if (wanted !== undefined) {
    const unknown = wanted.filter((id) => !deduped.some((item) => item.topics.includes(id)));
    if (unknown.length > 0) warnings.push(`这些主题本轮没有命中论文：${unknown.join(', ')}`);
  }
  if (filtered.length === 0) warnings.push('这一轮没抓到任何论文：换个主题词、把 days 调大，或检查网络。');

  return { items: filtered, warnings, perSource: perSourceCount };
}

function tag(paper: Omit<RadarItem, 'topics'> | RadarItem): RadarItem {
  const topics = 'topics' in paper && Array.isArray(paper.topics) ? paper.topics : detectTopics(`${paper.title} ${paper.abstract}`);
  return { ...paper, topics };
}

/** 先按 DOI 去重（同一篇常同时出现在 bioRxiv 与 PubMed），再按 id 去重（同 id 保留先出现的）。 */
function dedupe(items: RadarItem[]): RadarItem[] {
  const byDoi = new Map<string, RadarItem>();
  const byId = new Map<string, RadarItem>();
  for (const item of items) {
    const doi = item.doi?.toLowerCase();
    const existing = doi === undefined ? undefined : byDoi.get(doi);
    if (existing !== undefined) {
      // 保留摘要更长的那条（PubMed 的摘要常被截断，bioRxiv 更全）。
      const winner = item.abstract.length > existing.abstract.length ? item : existing;
      byDoi.set(doi as string, winner);
      // 胜者可能是「后出现」的条目、从未进过 byId；败者则必须从 byId 里去掉。
      // 否则末尾的过滤会把胜者（不在 byId）和败者（不在 keep）一起丢掉 —— v0.1.0 评审发现的回归。
      byId.delete(existing.id);
      if (!byId.has(winner.id)) byId.set(winner.id, winner);
      continue;
    }
    if (doi !== undefined) byDoi.set(doi, item);
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const keep = new Set(byDoi.values());
  return [...byId.values()].filter((item) => keep.has(item) || item.doi === undefined);
}