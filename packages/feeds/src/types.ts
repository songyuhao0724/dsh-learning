/** 抓取层只依赖这个最小接口，测试里换成假的即可，不必起本地服务器。 */
export interface FetchLike {
  (
    input: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}

export type FeedKind = 'rss' | 'atom';

/** 一条实测可达的免费信源（都不需要学校订阅）。 */
export interface FeedSource {
  id: string;
  name: string;
  url: string;
  kind: FeedKind;
  /** 期刊 / 预印本 / 厂商官方 / 研究机构 / 媒体 / 社区 */
  group: string;
  topics: string[];
  lang: 'en';
  note?: string;
}

/** 解析后、入库前的一条资讯。 */
export interface RawFeedItem {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  topics: string[];
}

/** 库里的一条资讯。 */
export interface StoredFeedItem extends RawFeedItem {
  fetchedAt: string;
}

export interface SourceResult {
  sourceId: string;
  name: string;
  ok: boolean;
  /** 新增条数 */
  added: number;
  /** 本次解析出的条数 */
  seen: number;
  error?: string;
}

export interface RefreshReport {
  results: SourceResult[];
  added: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
}

export interface SearchOptions {
  query?: string;
  sourceIds?: string[];
  topics?: string[];
  /** YYYY-MM-DD 或完整 ISO 时间；只返回该时间之后的条目 */
  since?: string;
  limit?: number;
}

export interface FeedStoreStats {
  items: number;
  sources: number;
  earliest?: string;
  latest?: string;
}

/** 用户的资讯方向：由模型在初始化阶段按专业写成一份，供检索加权。 */
export interface DomainProfile {
  topics: string[];
  keywords: string[];
  exclude: string[];
  scoringNotes?: string;
  updatedAt?: string;
}