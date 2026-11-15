/**
 * 可得性路由：给定 DOI / 题名 / PMID，回答「这篇文献现在怎么拿到全文」。
 *
 * 三个数据源都是免费公开的 OA 元数据服务：
 * - Unpaywall：需要联系邮箱（不带 email 会 422）
 * - OpenAlex：免 key，带 mailto 进 polite pool
 * - Europe PMC：免 key，顺带拿到 PMCID 与全文链接清单
 *
 * 设计约束：
 * 1. **不抓取全文、不绕付费墙**。这里只回答「哪里有合法副本」并把 URL 交给用户。
 * 2. 任何一路失败都只记 warning，不影响其它路（学术网络环境经常半通不通）。
 * 3. 无 OA 时给「去 CARSI 目录里哪个库查」的建议，而不是让用户空手而归。
 */
import { findResources, recommendResources } from './catalog.js';
import type {
  AccessPlan,
  AvailabilityOptions,
  AvailabilityQuery,
  FetchLike,
  LibraryResource,
  OaStatus,
  Route,
} from './types.js';

const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2/';
const OPENALEX_WORKS = 'https://api.openalex.org/works';
const EUROPEPMC_SEARCH = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

type JsonBag = Record<string, unknown>;

function isRecord(value: unknown): value is JsonBag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function firstRecord(value: unknown): JsonBag | null {
  const [head] = asArray(value);
  return isRecord(head) ? head : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** 去掉 `https://doi.org/`、`doi:` 前缀，返回裸 DOI。 */
export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
}

const OA_STATUSES: readonly OaStatus[] = ['gold', 'hybrid', 'bronze', 'green', 'closed', 'unknown'];

function toOaStatus(value: unknown): OaStatus {
  const raw = asString(value)?.toLowerCase();
  if (raw === 'diamond') return 'gold';
  return OA_STATUSES.find((status) => status === raw) ?? 'unknown';
}

function routeKey(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/**
 * 查询一篇文献的可得性。
 *
 * 全部请求失败也不会抛错 —— 返回带 warnings 的降级结果，让用户知道为什么没查到。
 */
export async function planAccess(
  query: AvailabilityQuery,
  options: AvailabilityOptions = {},
): Promise<AccessPlan> {
  const warnings: string[] = [];
  const routes: Route[] = [];
  const doi = query.doi !== undefined ? normalizeDoi(query.doi) : undefined;
  const email = options.email?.trim();
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs ?? 8000;
  let oaStatus: OaStatus = 'unknown';

  const getJson = async (label: string, url: string): Promise<JsonBag | null> => {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        warnings.push(`${label} 返回 HTTP ${response.status}，已跳过这一路。`);
        return null;
      }
      const parsed: unknown = await response.json();
      return isRecord(parsed) ? parsed : null;
    } catch (error: unknown) {
      warnings.push(`${label} 请求失败（${errorMessage(error)}），已跳过这一路。`);
      return null;
    }
  };

  const addRoute = (route: Route): void => {
    const key = routeKey(route.url);
    if (routes.some((existing) => routeKey(existing.url) === key)) return;
    routes.push(route);
  };

  // —— Unpaywall（最权威的 OA 判定；必须带 email）——
  if (doi !== undefined && doi !== '') {
    if (email === undefined || email === '') {
      warnings.push('没有配置联系邮箱：已跳过 Unpaywall（它要求带 email 参数，否则 422）。');
    } else {
      const url = `${UNPAYWALL_BASE}${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
      const data = await getJson('Unpaywall', url);
      if (data !== null) {
        oaStatus = toOaStatus(data.oa_status);
        const candidates = [data.best_oa_location, ...asArray(data.oa_locations)];
        for (const candidate of candidates) {
          if (!isRecord(candidate)) continue;
          const link = asString(candidate.url_for_pdf) ?? asString(candidate.url);
          if (link === null) continue;
          addRoute({
            kind: 'oa',
            label: `开放获取全文（${asString(candidate.host_type) ?? 'OA 副本'}）`,
            url: link,
            license: asString(candidate.license),
            needsSubscription: false,
            source: 'unpaywall',
          });
        }
      }
    }
  }

  // —— OpenAlex（DOI 或题名都能查，免 key）——
  const mailto = email !== undefined && email !== '' ? `mailto=${encodeURIComponent(email)}` : '';
  let openAlexUrl: string | null = null;
  if (doi !== undefined && doi !== '') {
    openAlexUrl = `${OPENALEX_WORKS}/https://doi.org/${doi}`;
  } else if (query.title !== undefined && query.title.trim() !== '') {
    openAlexUrl = `${OPENALEX_WORKS}?filter=title.search:${encodeURIComponent(query.title.trim())}&per-page=3`;
  }
  if (openAlexUrl !== null) {
    const withMail = mailto === '' ? openAlexUrl : `${openAlexUrl}${openAlexUrl.includes('?') ? '&' : '?'}${mailto}`;
    const data = await getJson('OpenAlex', withMail);
    const work = data === null ? null : isRecord(data.results) ? firstRecord(data.results) : data;
    if (work !== null) {
      const openAccess = isRecord(work.open_access) ? work.open_access : null;
      if (openAccess !== null) {
        oaStatus = oaStatus === 'unknown' ? toOaStatus(openAccess.oa_status) : oaStatus;
        const oaUrl = asString(openAccess.oa_url);
        if (oaUrl !== null) {
          addRoute({
            kind: 'oa',
            label: '开放获取全文（OpenAlex）',
            url: oaUrl,
            needsSubscription: false,
            source: 'openalex',
          });
        }
      }
      for (const location of asArray(work.locations)) {
        if (!isRecord(location)) continue;
        const link = asString(location.pdf_url) ?? asString(location.landing_page_url);
        if (link === null) continue;
        const source = isRecord(location.source) ? location.source : null;
        const sourceType = asString(source?.type);
        const isOa = asBoolean(location.is_oa) ?? false;
        addRoute({
          kind: sourceType === 'repository' ? 'repository' : 'publisher',
          label:
            sourceType === 'repository'
              ? `机构库/预印本：${asString(source?.display_name) ?? 'OpenAlex 记录'}`
              : `出版社页面：${asString(source?.display_name) ?? 'OpenAlex 记录'}`,
          url: link,
          license: asString(location.license),
          needsSubscription: !isOa,
          source: 'openalex',
        });
      }
    }
  }

  // —— Europe PMC（有 DOI 或 PMID 时补一条，尤其擅长预印本与 OA 子集）——
  const europePmcQuery =
    doi !== undefined && doi !== ''
      ? `DOI:"${doi}"`
      : query.pmid !== undefined && query.pmid.trim() !== ''
        ? `EXT_ID:${query.pmid.trim()}`
        : null;
  if (europePmcQuery !== null) {
    const url = `${EUROPEPMC_SEARCH}?query=${encodeURIComponent(europePmcQuery)}&format=json&resultType=core`;
    const data = await getJson('Europe PMC', url);
    const resultList = data !== null && isRecord(data.resultList) ? data.resultList : null;
    // 正常响应是 {resultList:{result:[...]}}；兼容直接返回单条记录的情况。
    const result = resultList !== null ? firstRecord(resultList.result) : data;
    if (result !== null) {
      const fullTextList = isRecord(result.fullTextUrlList) ? result.fullTextUrlList : null;
      for (const entry of asArray(fullTextList?.fullTextUrl)) {
        if (!isRecord(entry)) continue;
        const link = asString(entry.url);
        if (link === null) continue;
        const code = asString(entry.availabilityCode);
        const site = asString(entry.site) ?? 'Europe PMC';
        addRoute({
          kind: code === 'S' ? 'publisher' : 'oa',
          label: code === 'S' ? `出版社页面：${site}` : `开放获取全文（${site}）`,
          url: link,
          needsSubscription: code === 'S',
          source: 'europepmc',
        });
      }
      if (asString(result.isOpenAccess) === 'Y' && oaStatus === 'unknown') oaStatus = 'green';
    }
  }

  if (doi !== undefined && doi !== '' && routes.length === 0) {
    addRoute({
      kind: 'library',
      label: 'DOI 跳转（可能需要机构订阅）',
      url: `https://doi.org/${doi}`,
      needsSubscription: true,
      source: 'doi',
    });
    warnings.push('没有找到开放获取副本：DOI 只能把你带到出版社页面，机构订阅之外的地方不要尝试绕过。');
  }

  if (doi === undefined && europePmcQuery === null) {
    warnings.push('没有 DOI/PMID：跳过 Unpaywall 与 Europe PMC，只在 OpenAlex 里按题名碰运气。');
  }

  // 免费的排前面，同类别保持数据源顺序（unpaywall > openalex > europepmc）
  routes.sort((a, b) => Number(a.needsSubscription) - Number(b.needsSubscription));
  const best = routes.find((route) => !route.needsSubscription) ?? routes[0] ?? null;

  const suggestions = best !== null && !best.needsSubscription ? [] : suggestResources(query);

  return { query, oaStatus, best, routes, warnings, suggestions };
}

/** 拿不到 OA 时，去 CARSI 目录里查哪几个库。 */
function suggestResources(query: AvailabilityQuery): LibraryResource[] {
  const keywords = (query.keywords ?? []).join(' ').trim();
  const tries = [keywords, query.title?.trim() ?? ''].filter((item) => item !== '');
  for (const needle of tries) {
    const hits = findResources(needle, { limit: 3 }).filter(
      (resource) => resource.category === 'literature' || resource.category === 'index',
    );
    if (hits.length > 0) return hits;
  }
  const fallback = [...recommendResources('literature-en'), ...recommendResources('literature-zh')];
  const seen = new Set<string>();
  const unique: LibraryResource[] = [];
  for (const resource of fallback) {
    if (seen.has(resource.id)) continue;
    seen.add(resource.id);
    unique.push(resource);
    if (unique.length === 3) break;
  }
  return unique;
}