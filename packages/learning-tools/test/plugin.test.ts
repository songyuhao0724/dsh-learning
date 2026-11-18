import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTextPdf } from '../../scholar/test/fixtures/make-pdf.js';
import { apply } from '../src/index.js';
import type { PluginFetch, ToolDefinitionLike } from '../src/types.js';

/** 离线 fetch：雷达与科研数据工具都不该在测试里打真网络。 */
function offlineFetch(): PluginFetch {
  const arxiv = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2601.01234v1</id><published>2026-01-05T00:00:00Z</published><title>Deep learning for medical imaging</title><summary>Review of medical imaging models.</summary><author><name>Ada</name></author></entry></feed>`;
  const geoSearch = { esearchresult: { count: '1', idlist: ['200349653'] } };
  const geoSummary = {
    result: {
      uids: ['200349653'],
      '200349653': {
        accession: 'GSE349653',
        title: 'IgD-secreting plasma cells in lung cancer',
        summary: 'We profile plasma cells.',
        taxon: 'Homo sapiens',
        gdstype: 'Expression profiling by high throughput sequencing',
        n_samples: '12',
        gpl: 'GPL24676',
        pubmedids: ['40000001'],
        pdat: '2026/01/05',
      },
    },
  };
  return async (input) => {
    if (input.startsWith('https://export.arxiv.org')) {
      return { ok: true, status: 200, text: async () => arxiv, json: async () => ({}) };
    }
    if (input.startsWith('https://api.biorxiv.org')) {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ collection: [] }) };
    }
    if (input.includes('db=gds') && input.includes('esearch')) {
      return { ok: true, status: 200, text: async () => '', json: async () => geoSearch };
    }
    if (input.includes('db=gds') && input.includes('esummary')) {
      return { ok: true, status: 200, text: async () => '', json: async () => geoSummary };
    }
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
  };
}

/** 假的 ctx：只记下注册的工具，用来验证「注册出来的东西是合法的、执行是能跑的」。 */
function fakeContext(): { tools: Map<string, ToolDefinitionLike>; ctx: { tools: { register: (definition: ToolDefinitionLike) => () => void } } } {
  const tools = new Map<string, ToolDefinitionLike>();
  return {
    tools,
    ctx: {
      tools: {
        register(definition: ToolDefinitionLike) {
          tools.set(definition.name, definition);
          return () => tools.delete(definition.name);
        },
      },
    },
  };
}

// 注意：必须在这里（describe 收集阶段）就建好目录——describe 的回调早于 beforeAll 执行，
// 而 apply() 在回调里就跑，拿不到 beforeAll 里的 workspace 会退回 cwd。
const workspace = mkdtempSync(join(tmpdir(), 'dsh-learning-tools-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function call(tools: Map<string, ToolDefinitionLike>, name: string, args: unknown): Promise<unknown> {
  const definition = tools.get(name);
  if (definition === undefined) throw new Error(`没有注册 ${name}`);
  return definition.execute(args, {});
}

/** 走一遍真实执行 + render，确认给模型看的文本不是空的。 */
function renderText(tools: Map<string, ToolDefinitionLike>, name: string, value: unknown): string {
  const definition = tools.get(name);
  if (definition === undefined) throw new Error(`没有注册 ${name}`);
  const blocks = definition.output.render({}, value);
  return blocks.map((block) => block.text).join('\n');
}

describe('learning-tools 插件', () => {
  const { tools, ctx } = fakeContext();
  apply(ctx, { fetch: offlineFetch(), workspaceDir: workspace });

  it('注册了 18 个工具，名字都以 study_ 开头且不重复', () => {
    expect(tools.size).toBe(18);
    for (const name of tools.keys()) expect(name.startsWith('study_')).toBe(true);
  });

  it('每个工具都有合法的 parameters / output.schema / render / execute', () => {
    for (const [name, definition] of tools) {
      expect(definition.description.length, name).toBeGreaterThan(10);
      expect(definition.parameters, name).toMatchObject({ type: 'object' });
      expect(definition.output.schema, name).toMatchObject({ type: 'object' });
      expect(typeof definition.output.render, name).toBe('function');
      expect(typeof definition.execute, name).toBe('function');
    }
  });

  it('岗位画像工具返回 12 条内置岗位', async () => {
    const value = (await call(tools, 'study_career_occupations', {})) as { count: number };
    expect(value.count).toBe(12);
  });

  it('检索式工具能生成 PubMed 检索式', async () => {
    const value = (await call(tools, 'study_search_formula', {
      database: 'pubmed',
      keywords: ['脑卒中', '深度学习'],
      fromYear: 2020,
      types: ['review'],
    })) as { formula: string };
    expect(value.formula).toContain('[Title/Abstract]');
    expect(value.formula).toContain('2020');
    expect(value.formula).toContain('[pt]');
  });

  it('资源目录工具不联网也能按任务推荐', async () => {
    const value = (await call(tools, 'study_resources', { task: 'literature-zh' })) as { total: number; resources: Array<{ name: string }> };
    expect(value.total).toBeGreaterThan(0);
    expect(value.resources.length).toBeGreaterThan(0);
  });

  it('四年计划工具能按毕业去向分叉', async () => {
    const value = (await call(tools, 'study_career_plan', {
      degree: '考研',
      direction: '医疗健康大数据',
      occupationId: 'bioinfo-engineer',
      startYear: 2026,
    })) as { years: Array<{ label: string }>; occupation: { title: string } };
    expect(value.occupation.title).toBe('生物信息工程师');
    expect(value.years).toHaveLength(4);
    expect(value.years[0]?.label).toContain('大一');
    expect(renderText(tools, 'study_career_plan', value)).toContain('## 大一');
  });

  it('PDF 索引 + 检索端到端能跑通', async () => {
    const pdfPath = join(workspace, 'notes.pdf');
    writeFileSync(
      pdfPath,
      buildTextPdf([
        { lines: ['Rehabilitation robotics for stroke survivors'] },
        { lines: ['Genomic analysis of lung cancer cohorts'] },
      ]),
    );
    const indexPath = join(workspace, 'index.db');

    const indexed = (await call(tools, 'study_papers_index_pdf', {
      filePath: pdfPath,
      indexPath,
      title: '课程讲义',
    })) as { pages: number };
    expect(indexed.pages).toBe(2);

    const found = (await call(tools, 'study_papers_search', {
      indexPath,
      query: 'lung cancer',
    })) as { count: number; hits: Array<{ title: string; page: number }> };
    expect(found.count).toBeGreaterThan(0);
    expect(found.hits[0]?.title).toBe('课程讲义');
    expect(found.hits[0]?.page).toBe(2);
    expect(renderText(tools, 'study_papers_search', found)).toContain('课程讲义');
  });

  it('热点雷达工具能抓取、打标并给出 AIHOT feed 契约', async () => {
    const value = (await call(tools, 'study_papers_radar', { days: 7, perSource: 3, limit: 5 })) as {
      count: number;
      items: Array<{ title: string; topics: string[]; source: string }>;
      aihot: Record<string, unknown>;
      feed: { data: { items: Array<{ published_at: string; url: string }> } };
    };
    expect(value.count).toBeGreaterThan(0);
    expect(value.items[0]?.source).toBe('arxiv');
    expect(value.items[0]?.topics.join()).toContain('医学影像');
    expect(value.aihot['itemsPath']).toBe('data.items');
    expect(value.feed.data.items[0]?.published_at).toBe('2026-01-05T00:00:00.000Z');
    const rendered = renderText(tools, 'study_papers_radar', value);
    expect(rendered).toContain('抓到');
    expect(rendered).toContain('aihot');
  });

  it('科研数据工具能检索 GEO 数据集', async () => {
    const value = (await call(tools, 'study_bio_data_search', { source: 'geo', term: 'lung cancer', limit: 5 })) as {
      count: number;
      items: Array<{ accession: string; organism?: string; samples?: number; url: string }>;
    };
    expect(value.count).toBe(1);
    expect(value.items[0]?.accession).toBe('GSE349653');
    expect(value.items[0]?.samples).toBe(12);
    expect(renderText(tools, 'study_bio_data_search', value)).toContain('GSE349653');
  });

  it('科研数据工具对国内平台只给深链，不抓页面', async () => {
    const value = (await call(tools, 'study_bio_data_search', { source: 'cngbdb', term: '单细胞 肺癌' })) as {
      links: Array<{ name: string; url: string }>;
    };
    expect(value.links).toHaveLength(3);
    expect(value.links[0]?.url).toContain(encodeURIComponent('单细胞 肺癌'));
    expect(renderText(tools, 'study_bio_data_search', value)).toContain('没有公开检索接口');
  });

  it('缺参数时抛出能照着做的中文错误', async () => {
    await expect(call(tools, 'study_papers_search', { query: 'x' })).rejects.toThrow(/indexPath/);
    await expect(call(tools, 'study_career_plan', { degree: '考研' })).rejects.toThrow(/direction/);
  });

  it('档案工具：空档案 → 保存 → 完整度上升、md 落盘', async () => {
    const before = (await call(tools, 'study_profile_status', {})) as {
      completion: number;
      requiredTotal: number;
      missing: Array<{ label: string }>;
      nextQuestions: string[];
    };
    expect(before.completion).toBe(0);
    expect(before.requiredTotal).toBeGreaterThanOrEqual(8);
    expect(before.missing.length).toBe(before.requiredTotal);
    expect(before.nextQuestions).toHaveLength(3);
    expect(renderText(tools, 'study_profile_status', before)).toContain('档案完整度');

    const saved = (await call(tools, 'study_profile_save', {
      updates: { name: '宋宇昊', school: '康复大学', grade: '2026 级 本科' },
      milestones: ['2026-11-18 首次建立档案'],
    })) as { changed: string[]; completion: number; files: { markdown: string } };
    expect(saved.changed.sort()).toEqual(['grade', 'name', 'school']);
    expect(saved.completion).toBeGreaterThan(0);

    const after = (await call(tools, 'study_profile_status', {})) as { summary: string; completion: number };
    expect(after.summary).toContain('宋宇昊');
    expect(after.completion).toBeGreaterThan(0);
  });

  it('档案工具：未知字段会被明确忽略而不是静默吞掉', async () => {
    const result = (await call(tools, 'study_profile_save', {
      updates: { nickname: '小宋' },
    })) as { changed: string[]; ignored: string[] };
    expect(result.changed).toEqual([]);
    expect(result.ignored).toContain('nickname');
    const rendered = renderText(tools, 'study_profile_save', result);
    expect(rendered).toContain('已忽略');
  });

  it('资源体检工具给出五类检查与补救建议', async () => {
    const report = (await call(tools, 'study_resource_check', {})) as {
      items: Array<{ key: string; status: string; fix?: string }>;
      headline: string;
    };
    expect(report.items).toHaveLength(5);
    expect(report.items.map((item) => item.key)).toContain('zoteroDbPath');
    expect(report.headline).toMatch(/就绪|待完善|缺失/);
    expect(report.items.some((item) => item.fix !== undefined)).toBe(true);
  });

  it('引导页工具会落一个能双击打开的 HTML', async () => {
    const result = (await call(tools, 'study_profile_wizard', {})) as {
      path: string;
      bytes: number;
      completion: number;
    };
    expect(result.path.endsWith('初始化向导.html')).toBe(true);
    expect(result.bytes).toBeGreaterThan(4000);
    const html = readFileSync(result.path, 'utf8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('id="wizard-data"');
    expect(html).toContain('初始化向导');
    expect(renderText(tools, 'study_profile_wizard', result)).toContain('双击');
  });
});