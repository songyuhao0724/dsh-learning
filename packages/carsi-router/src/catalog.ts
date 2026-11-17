/**
 * CARSI 资源目录的查询与推荐。
 *
 * 设计要点：这是「去哪儿找」的知识库，不是入口爬虫。
 * 所有 URL 都由用户在自己的浏览器里打开（已登录 CARSI 的情况下），
 * 本模块只做匹配与解释。
 */
import { CARSI_RESOURCES, CATALOG_META } from './data/carsi-resources.js';
import type { AccessKind, LibraryResource, ResourceCategory, TaskKind } from './types.js';

/** 任务 → 优先资源 id（按顺序）。 */
const TASK_RECOMMENDATIONS: Record<TaskKind, string[]> = {
  'literature-en': ['web-of-science', 'sciencedirect', 'springerlink', 'wiley', 'nature', 'oxford-journals'],
  'literature-zh': ['cnki', 'wanfang', 'cqvip', 'yiigle', 'nstl', 'duxiu'],
  'journal-ranking': ['cas-jcr', 'web-of-science'],
  'research-data': ['cngbdb', 'dde', 'oscca-cloud'],
  'ai-study': ['medseek', 'miguo'],
  course: ['shangniu-course', 'cernet-video-course', 'medseek'],
  patent: ['patent-platform'],
  bioinformatics: ['cngbdb', 'sciencedirect', 'web-of-science', 'springerlink', 'oscca-cloud'],
};

export interface FindOptions {
  category?: ResourceCategory;
  access?: AccessKind;
  limit?: number;
}

/** 全部资源（返回副本，调用方改不到内置数据）。 */
export function listResources(): LibraryResource[] {
  return CARSI_RESOURCES.map((resource) => ({ ...resource }));
}

/**
 * 按关键词检索资源。
 *
 * 打分：名称命中 3 分、提供方 2 分、覆盖范围 2 分、备注/分类 1 分。
 * 中文用简单子串匹配即可（92 条的量级不需要分词）。
 */
export function findResources(query: string, options: FindOptions = {}): LibraryResource[] {
  const needle = query.trim().toLowerCase();
  const pool = CARSI_RESOURCES.filter(
    (resource) =>
      (options.category === undefined || resource.category === options.category) &&
      (options.access === undefined || resource.access === options.access),
  );
  if (needle === '') return pool.slice(0, options.limit ?? pool.length).map((r) => ({ ...r }));

  const scored = pool
    .map((resource) => {
      let score = 0;
      if (resource.name.toLowerCase().includes(needle)) score += 3;
      if (resource.provider.toLowerCase().includes(needle)) score += 2;
      if (resource.id.toLowerCase().includes(needle)) score += 2;
      for (const item of resource.coverage ?? []) {
        if (item.toLowerCase().includes(needle) || needle.includes(item.toLowerCase())) score += 2;
      }
      if ((resource.note ?? '').toLowerCase().includes(needle)) score += 1;
      return { resource, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const limit = options.limit ?? scored.length;
  return scored.slice(0, limit).map((entry) => ({ ...entry.resource }));
}

/** 按任务类型给出「先开哪几个库」。 */
export function recommendResources(task: TaskKind): LibraryResource[] {
  const ids = TASK_RECOMMENDATIONS[task];
  const byId = new Map(CARSI_RESOURCES.map((resource) => [resource.id, resource]));
  return ids
    .map((id) => byId.get(id))
    .filter((resource): resource is LibraryResource => resource !== undefined)
    .map((resource) => ({ ...resource }));
}

/** 打开一条资源时的操作提示（有官方 URL 就直说，没有才讲流程）。 */
export function openHint(resource: LibraryResource): string {
  const base = '在浏览器里先登录 CARSI（ds.carsi.edu.cn），再从资源门户点开该资源。';
  if (resource.reachable === 'unreachable') {
    return `这个入口在通用网络上连不通（DNS/TLS 超时），别在命令行里反复重试：换从图书馆门户点，或到校网/已登录状态下再打开。${resource.url === undefined ? '' : `图书馆记录的地址是 ${resource.url}`}`;
  }
  if (resource.reachable === 'open' && resource.url !== undefined) {
    return `可以直接打开：${resource.url}（免费或开放获取，不依赖学校登录）。`;
  }
  const entry = resource.url === undefined ? '' : `入口：${resource.url}（不带本校登录态会被拦，属正常）。`;
  const session = resource.reachable === 'session' ? `${entry}${base}` : base;
  switch (resource.category) {
    case 'index':
      return `${session}检索类工具建议先用 Web of Science 收窄范围，再用分区表判断期刊层次。`;
    case 'data':
      return `${session}数据平台通常需要注册账号；先读数据使用条款再下载。`;
    case 'ai-tool':
      return `${session}AI 类工具只用来辅助理解，结论要回到原始文献核对。`;
    case 'course':
      return `${session}视频课程可以先看目录，判断是否覆盖你本周要学的内容。`;
    case 'patent':
      return `${session}专利检索按「技术特征 + 申请年」组合，先看同类专利的权利要求书。`;
    case 'compute':
      return `${session}算力/建模平台一般要申请额度，先在课程群里确认学校是否已开通。`;
    default:
      return session;
  }
}

export interface CatalogSummary {
  meta: typeof CATALOG_META;
  total: number;
  byAccess: Record<AccessKind, number>;
  byCategory: Record<string, number>;
}

/** 目录概况：门户统计 + 本仓库已收录情况。 */
export function catalogSummary(): CatalogSummary {
  const byAccess: Record<AccessKind, number> = { subscription: 0, free: 0, trial: 0 };
  const byCategory: Record<string, number> = {};
  for (const resource of CARSI_RESOURCES) {
    byAccess[resource.access] += 1;
    byCategory[resource.category] = (byCategory[resource.category] ?? 0) + 1;
  }
  return { meta: { ...CATALOG_META }, total: CARSI_RESOURCES.length, byAccess, byCategory };
}