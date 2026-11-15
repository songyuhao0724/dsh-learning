/** 资源获取方式。 */
export type AccessKind = 'subscription' | 'free' | 'trial';

/** 资源大类，用来做「我现在要干这件事，该去哪儿」的推荐。 */
export type ResourceCategory =
  | 'literature' // 论文/期刊/图书全文
  | 'index' // 检索与评价工具（WoS、分区表）
  | 'data' // 科研数据平台
  | 'ai-tool' // AI 学伴/大模型
  | 'course' // 课程/教学资源
  | 'patent' // 专利
  | 'compute'; // 计算/建模平台

/**
 * 一条 CARSI 资源。
 *
 * `verified` 表示这条信息有明确出处（门户截图/官方页面），能被社区复核；
 * 未经验证的条目一律不进内置目录 —— 宁可少写，不要写错。
 */
export interface LibraryResource {
  /** 稳定的短 id，用于推荐表与用户自定义覆盖。 */
  id: string;
  name: string;
  /** 提供方/平台方。 */
  provider: string;
  access: AccessKind;
  category: ResourceCategory;
  /** 适合检索什么内容，用于关键词匹配。 */
  coverage?: string[];
  /** 人话备注：入口形式、是否需要个人账号等。 */
  note?: string;
  /** 官方入口（拿不到就留空，绝不编造）。 */
  url?: string;
  verified: boolean;
}

export interface CatalogMeta {
  collectedOn: string;
  portal: string;
  institution: string;
  /** 门户上按本校权限统计的条目数。 */
  counts: { total: number; subscription: number; free: number; trial: number; mixed: number };
  note: string;
}

/** 学术任务的种类，决定推荐哪些资源。 */
export type TaskKind =
  | 'literature-en'
  | 'literature-zh'
  | 'journal-ranking'
  | 'research-data'
  | 'ai-study'
  | 'course'
  | 'patent'
  | 'bioinformatics';

/** 用户可能遇到的「拿不到全文」情形。 */
export type RouteKind = 'oa' | 'publisher' | 'preprint' | 'repository' | 'library';

export interface Route {
  kind: RouteKind;
  /** 给用户看的说明（中文）。 */
  label: string;
  url: string;
  /** 许可证/开放状态，能拿到就写。 */
  license?: string | null;
  /** 是否需要机构订阅（CARSI 登录态）才能打开。 */
  needsSubscription: boolean;
  /** 这条路由来自哪个数据源。 */
  source: 'unpaywall' | 'openalex' | 'europepmc' | 'doi' | 'local';
}

export type OaStatus = 'gold' | 'hybrid' | 'bronze' | 'green' | 'closed' | 'unknown';

export interface AvailabilityQuery {
  doi?: string;
  title?: string;
  pmid?: string;
  /** 中文标题/关键词，用于在 CARSI 目录里给建议。 */
  keywords?: string[];
}

export interface AccessPlan {
  query: AvailabilityQuery;
  oaStatus: OaStatus;
  /** 首选打开方式；没有任何路由时为 null。 */
  best: Route | null;
  routes: Route[];
  /** 查不到/被限流时的降级原因，如实告诉用户。 */
  warnings: string[];
  /** 没有开放获取版本时，建议用户去 CARSI 目录里的哪些库检索。 */
  suggestions: LibraryResource[];
}

/** 可注入的 fetch（测试里替换，生产用全局 fetch）。 */
export interface FetchLike {
  (
    input: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export interface AvailabilityOptions {
  /** Unpaywall 要求带联系邮箱；OpenAlex 用它进 polite pool。 */
  email?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}