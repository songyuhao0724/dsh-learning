/** 支持的公共数据源。CNGBdb 等国内平台没有公开检索 API，只给门户深链，不算「源」。 */
export type BioSource = 'geo' | 'sra';

/** GEO 数据集（GSE 级别）。字段名对齐 NCBI esummary 的原始键，便于对照排查。 */
export interface GeoDataset {
  /** GSE 编号，例如 GSE349653。 */
  accession: string;
  title: string;
  summary: string;
  /** 物种，例如 Homo sapiens。 */
  organism?: string;
  /** 研究类型，例如 "Expression profiling by high throughput sequencing"。 */
  studyType?: string;
  /** 样本数。 */
  samples?: number;
  /** 平台编号（GPL）。 */
  platform?: string;
  pubmedIds: string[];
  /** 数据更新日期（原始 pdat）。 */
  updatedAt?: string;
  url: string;
  /** FTP 下载地址（原始 ftplink）。 */
  ftp?: string;
  bioproject?: string;
}

/** SRA 研究（SRP 级别）。SRA 的 esummary 只回一个 expxml 字符串，这里把它拆成结构化字段。 */
export interface SraStudy {
  accession: string;
  title: string;
  organism?: string;
  /** Run 数量。 */
  runs: number;
  url: string;
}

export interface BioSearchResult<T> {
  source: BioSource;
  query: string;
  /** 服务端命中的总条数（可能远大于 items.length）。 */
  count: number;
  items: T[];
  warnings: string[];
}

export interface EutilsIdentity {
  tool?: string;
  email?: string;
}

export interface FetchLike {
  (
    input: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export interface SearchOptions {
  term: string;
  maxResults?: number;
  identity?: EutilsIdentity;
  signal?: AbortSignal;
  /** 注入用，测试里替换成假 fetch。 */
  fetch?: FetchLike;
}

export interface CngbLink {
  name: string;
  url: string;
  note: string;
}