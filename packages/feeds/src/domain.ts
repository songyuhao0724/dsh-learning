import type { DomainProfile } from './types.js';

/**
 * 资讯方向（学科画像）打分。
 *
 * 这不是「AI 打分」——只是很朴素的关键词加权，用来在检索结果里把用户自己专业的
 * 东西排前面。真正的理解与摘要由模型在会话里完成（它拿到列表后自己写）。
 */
export interface DomainSubject {
  title: string;
  summary: string;
  topics?: string[];
}

export interface DomainHit {
  score: number;
  hits: string[];
}

const MAX_TOPICS = 12;
const MAX_KEYWORDS = 40;
const MAX_TERM_LENGTH = 40;

function cleanTerms(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const term = value.replace(/\s+/g, ' ').trim();
    if (term === '' || term.length > MAX_TERM_LENGTH) continue;
    const lower = term.toLowerCase();
    if (out.some((existing) => existing.toLowerCase() === lower)) continue;
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeDomain(input: Partial<DomainProfile> | undefined): DomainProfile {
  const domain: DomainProfile = {
    topics: cleanTerms(input?.topics, MAX_TOPICS),
    keywords: cleanTerms(input?.keywords, MAX_KEYWORDS),
    exclude: cleanTerms(input?.exclude, MAX_KEYWORDS),
  };
  if (typeof input?.scoringNotes === 'string' && input.scoringNotes.trim() !== '') {
    domain.scoringNotes = input.scoringNotes.trim().slice(0, 500);
  }
  if (typeof input?.updatedAt === 'string' && input.updatedAt !== '') domain.updatedAt = input.updatedAt;
  return domain;
}

export function isDomainEmpty(domain: DomainProfile | undefined): boolean {
  if (domain === undefined) return true;
  return domain.topics.length === 0 && domain.keywords.length === 0;
}

/** 关键词命中：标题权重 3，主题标签权重 2，摘要权重 1；命中排除词直接判 0。 */
export function domainMatch(subject: DomainSubject, domain: DomainProfile | undefined): DomainHit {
  if (domain === undefined) return { score: 0, hits: [] };
  const title = subject.title.toLowerCase();
  const summary = subject.summary.toLowerCase();
  const topics = (subject.topics ?? []).join(' ').toLowerCase();
  const hits: string[] = [];
  let score = 0;

  for (const term of domain.exclude) {
    const needle = term.toLowerCase();
    if (title.includes(needle) || summary.includes(needle) || topics.includes(needle)) {
      return { score: 0, hits: [`排除：${term}`] };
    }
  }
  for (const term of [...domain.topics, ...domain.keywords]) {
    const needle = term.toLowerCase();
    const inTitle = title.includes(needle);
    const inTopics = topics.includes(needle);
    const inSummary = summary.includes(needle);
    if (!inTitle && !inTopics && !inSummary) continue;
    score += (inTitle ? 3 : 0) + (inTopics ? 2 : 0) + (inSummary ? 1 : 0);
    if (hits.length < 6) hits.push(term);
  }
  return { score, hits };
}

/** 按方向分排序（稳定排序，同分保持原有时间顺序）。 */
export function rankByDomain<T extends DomainSubject>(
  items: T[],
  domain: DomainProfile | undefined,
): Array<T & { domainScore: number; domainHits: string[] }> {
  const scored = items.map((item, index) => {
    const hit = domainMatch(item, domain);
    return { item, index, ...hit };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return scored.map(({ item, score, hits }) => ({ ...item, domainScore: score, domainHits: hits }));
}