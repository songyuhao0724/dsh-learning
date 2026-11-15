import { describe, expect, it } from 'vitest';
import { normalizeDoi, planAccess } from '../src/availability.js';
import type { FetchLike } from '../src/types.js';

interface FakeOptions {
  /** 按 URL 返回响应体；抛错则模拟网络失败。 */
  handler: (url: string) => unknown;
}

/** 记录请求 URL 的假 fetch：既能断言「请求长什么样」，又能断言「合并成什么样」。 */
function fakeFetch(options: FakeOptions): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const body = options.handler(url);
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetch: impl as unknown as FetchLike, calls };
}

const doi = '10.1000/xyz123';

describe('DOI 归一化', () => {
  it('去掉 doi.org 前缀与 doi: 前缀', () => {
    expect(normalizeDoi('https://doi.org/10.1000/xyz')).toBe('10.1000/xyz');
    expect(normalizeDoi('doi: 10.1000/xyz')).toBe('10.1000/xyz');
    expect(normalizeDoi(' 10.1000/xyz ')).toBe('10.1000/xyz');
  });
});

describe('可得性路由', () => {
  it('三路都通时合并去重，OA 排第一', async () => {
    const { fetch, calls } = fakeFetch({
      handler: (url) => {
        if (url.includes('unpaywall')) {
          return {
            is_oa: true,
            oa_status: 'gold',
            best_oa_location: {
              url_for_pdf: 'https://example.org/a.pdf',
              host_type: 'publisher',
              license: 'cc-by',
            },
            oa_locations: [],
          };
        }
        if (url.includes('openalex')) {
          return {
            open_access: { is_oa: true, oa_status: 'gold', oa_url: 'https://example.org/a.pdf' },
            locations: [
              { pdf_url: 'https://example.org/a.pdf', is_oa: true, source: { display_name: '期刊', type: 'journal' } },
              {
                landing_page_url: 'https://repo.example.org/1',
                is_oa: true,
                source: { display_name: '机构库', type: 'repository' },
              },
            ],
          };
        }
        return { resultList: { result: [] } };
      },
    });

    const plan = await planAccess(
      { doi: `https://doi.org/${doi}` },
      { email: 'me@example.com', fetch },
    );

    expect(calls[0]).toContain('api.unpaywall.org/v2/10.1000%2Fxyz123?email=me%40example.com');
    expect(calls.some((url) => url.includes('api.openalex.org/works/https://doi.org/10.1000/xyz123'))).toBe(true);
    expect(plan.oaStatus).toBe('gold');
    // a.pdf 被 unpaywall 与 openalex 各报一次，只留一条
    expect(plan.routes.filter((route) => route.url === 'https://example.org/a.pdf')).toHaveLength(1);
    expect(plan.best?.url).toBe('https://example.org/a.pdf');
    expect(plan.best?.needsSubscription).toBe(false);
    expect(plan.suggestions).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it('没有邮箱时跳过 Unpaywall，只走 OpenAlex', async () => {
    const { fetch, calls } = fakeFetch({
      handler: (url) => {
        if (url.includes('openalex')) {
          return { open_access: { oa_status: 'closed' }, locations: [] };
        }
        return { resultList: { result: [] } };
      },
    });
    const plan = await planAccess({ doi }, { fetch });
    expect(calls.some((url) => url.includes('unpaywall'))).toBe(false);
    expect(plan.warnings.join('\n')).toContain('Unpaywall');
    expect(plan.routes.map((route) => route.source)).toContain('doi');
  });

  it('全部请求失败也不抛错：降级为 DOI 跳转 + CARSI 建议', async () => {
    const { fetch } = fakeFetch({
      handler: () => new Error('fetch failed'),
    });
    const plan = await planAccess({ doi, keywords: ['脑卒中', '康复'] }, { email: 'me@example.com', fetch });
    expect(plan.warnings.length).toBeGreaterThanOrEqual(3);
    expect(plan.best?.needsSubscription).toBe(true);
    expect(plan.best?.url).toBe(`https://doi.org/${doi}`);
    expect(plan.suggestions.length).toBeGreaterThan(0);
    expect(plan.suggestions.every((resource) => ['literature', 'index'].includes(resource.category))).toBe(true);
  });

  it('只有 PMID 时查 Europe PMC，并按 availabilityCode 判断是否需要订阅', async () => {
    const { fetch, calls } = fakeFetch({
      handler: (url) => {
        if (url.includes('europepmc')) {
          return {
            resultList: {
              result: [
                {
                  isOpenAccess: 'N',
                  fullTextUrlList: {
                    fullTextUrl: [
                      { availability: 'Subscription required', availabilityCode: 'S', site: '出版社', url: 'https://pub.example.org/x' },
                    ],
                  },
                },
              ],
            },
          };
        }
        return { resultList: { result: [] } };
      },
    });
    const plan = await planAccess({ pmid: '12345678' }, { fetch });
    expect(calls.some((url) => url.includes('EXT_ID%3A12345678'))).toBe(true);
    expect(plan.routes[0]).toMatchObject({ source: 'europepmc', needsSubscription: true, kind: 'publisher' });
  });

  it('只有题名时用 OpenAlex 题名检索，并带上 mailto', async () => {
    const { fetch, calls } = fakeFetch({ handler: () => ({ results: [] }) });
    await planAccess({ title: '康复机器人 综述' }, { email: 'me@example.com', fetch });
    const openAlexCall = calls.find((url) => url.includes('openalex'));
    expect(openAlexCall).toContain('filter=title.search:');
    expect(openAlexCall).toContain('mailto=me%40example.com');
  });

  it('HTTP 非 200 只记 warning，不当作成功', async () => {
    const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const plan = await planAccess({ doi }, { email: 'me@example.com', fetch: fetchImpl as unknown as FetchLike });
    expect(plan.warnings.join('\n')).toContain('HTTP 429');
    expect(plan.best?.source).toBe('doi');
  });
});