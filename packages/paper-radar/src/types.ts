/** 论文雷达的数据模型。 */

export type PaperSource = 'arxiv' | 'biorxiv' | 'medrxiv' | 'pubmed';

export interface RawPaper {
  /** 跨源唯一：`<source>:<nativeId>`，用于去重与 AIHOT 的 externalIdPath。 */
  id: string;
  source: PaperSource;
  title: string;
  abstract: string;
  authors: string[];
  publishedAt: string;
  url: string;
  doi?: string;
}

export interface Topic {
  id: string;
  label: string;
  /** 命中即算该主题；匹配标题 + 摘要。 */
  patterns: RegExp[];
}

export interface RadarItem extends RawPaper {
  topics: string[];
}

export interface RadarOptions {
  /** 只要这些主题的论文（给 id 或 label）；为空表示全部主题都要。 */
  topics?: string[];
  /** 往前看几天，默认 7。 */
  days?: number;
  /** 每个源最多抓多少条，默认 25。 */
  perSource?: number;
  /** 主题检索词：传给 arXiv 的 all: 查询，并在给出时启用 PubMed。 */
  query?: string;
  /** 注入的 fetch，便于测试。 */
  fetch?: FetchLike;
  /** 注入的「现在」，便于测试。 */
  now?: Date;
}

export interface FetchLike {
  (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }>;
}

export interface AiHotFeedItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
  source: PaperSource;
  tags: string[];
  authors: string;
  doi?: string;
}

/** AIHOT 的 `json_list` 信源只认这个形状（itemsPath=data.items）。 */
export interface AiHotFeed {
  data: {
    items: AiHotFeedItem[];
  };
}