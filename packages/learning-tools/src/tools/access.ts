import {
  buildSearchFormula,
  catalogSummary,
  findResources,
  openHint,
  planAccess,
  recommendResources,
} from '@dsh-learning/carsi-router';
import { pickConfig, readArray, readNumber, readString, requireString, text } from '../args.js';
import type { PluginContext, ToolsConfig } from '../types.js';

const OBJECT = { type: 'object' } as const;

const TASKS = [
  'literature-en',
  'literature-zh',
  'journal-ranking',
  'research-data',
  'ai-study',
  'course',
  'patent',
  'bioinformatics',
] as const;

const TASK_NAME: Record<string, string> = {
  'literature-en': '查英文文献',
  'literature-zh': '查中文文献',
  'journal-ranking': '查期刊分区/影响因子',
  'research-data': '找科研数据',
  'ai-study': 'AI 辅助学习',
  course: '找课程',
  patent: '查专利',
  bioinformatics: '做生物信息分析',
};

const ACCESS_NAME: Record<string, string> = {
  subscription: '学校已购',
  free: '免费',
  trial: '试用',
};

/** 资源与可得性工具：先判断「学校有没有、要花钱吗」，再给能直接点的链接。 */
export function registerAccessTools(ctx: PluginContext, config: ToolsConfig): void {
  const settings = pickConfig(config);

  ctx.tools.register({
    name: 'study_access_route',
    description:
      '给一篇文献（DOI / 标题 / PMID）查「怎么拿到全文」：并行查 Unpaywall、OpenAlex、Europe PMC 的开放获取版本，拿不到就给学校 CARSI 资源入口与检索建议。不抓全文、不绕付费墙。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        doi: { type: 'string', description: 'DOI，比如 10.1038/s41586-020-2649-2。' },
        title: { type: 'string', description: '没有 DOI 时给论文标题。' },
        pmid: { type: 'string', description: 'PubMed ID（可选）。' },
        keywords: { type: 'string', description: '主题词，用于在拿不到全文时推荐学校资源。' },
        email: { type: 'string', description: '查 Unpaywall 需要一个邮箱（它要求表明身份）；不传则用插件配置里的 contactEmail。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const plan = value as {
          oaStatus: string;
          best: { label: string; url: string; source: string; needsSubscription: boolean } | null;
          routes: Array<{ label: string; url: string; source: string; needsSubscription: boolean }>;
          warnings: string[];
          suggestions: Array<{ name: string; access: string; hint: string }>;
        };
        const lines: string[] = [];
        if (plan.best !== null && !plan.best.needsSubscription) {
          lines.push(`✅ 有开放获取版本（${plan.oaStatus}）：${plan.best.label}`, `   ${plan.best.url}`);
          const others = plan.routes.filter((route) => route.url !== plan.best?.url);
          if (others.length > 0) {
            lines.push('其它可用入口：', ...others.map((route) => `· ${route.label}：${route.url}`));
          }
        } else {
          lines.push('❌ 没找到合法免费全文（不是所有论文都有 OA 版本，这很正常）。');
          if (plan.best !== null) lines.push(`可尝试：${plan.best.label} ${plan.best.url}`);
          if (plan.suggestions.length > 0) {
            lines.push('', '从学校资源里找：');
            for (const suggestion of plan.suggestions) {
              lines.push(`· ${suggestion.name}（${ACCESS_NAME[suggestion.access] ?? suggestion.access}）`, `   ${suggestion.hint}`);
            }
          }
        }
        if (plan.warnings.length > 0) lines.push('', ...plan.warnings.map((warning) => `注意：${warning}`));
        return text(...lines);
      },
    },
    async execute(args) {
      const keywords = readString(args, 'keywords');
      const query = {
        ...(readString(args, 'doi') === undefined ? {} : { doi: readString(args, 'doi') as string }),
        ...(readString(args, 'title') === undefined ? {} : { title: readString(args, 'title') as string }),
        ...(readString(args, 'pmid') === undefined ? {} : { pmid: readString(args, 'pmid') as string }),
        ...(keywords === undefined
          ? {}
          : { keywords: keywords.split(/[\s,，、;；]+/).filter((word) => word !== '') }),
      };
      if (Object.keys(query).length === 0) {
        throw new Error('至少给一个 doi / title / pmid / keywords 才能查。');
      }
      const email = readString(args, 'email') ?? settings.contactEmail;
      const plan = await planAccess(query, email === undefined ? {} : { email });
      return {
        oaStatus: plan.oaStatus,
        best:
          plan.best === null
            ? null
            : { label: plan.best.label, url: plan.best.url, source: plan.best.source, needsSubscription: plan.best.needsSubscription },
        routes: plan.routes.map((route) => ({
          label: route.label,
          url: route.url,
          source: route.source,
          needsSubscription: route.needsSubscription,
        })),
        warnings: plan.warnings,
        suggestions: plan.suggestions.map((resource) => ({
          name: resource.name,
          access: resource.access,
          ...(resource.url === undefined ? {} : { url: resource.url }),
          hint: openHint(resource),
        })),
      };
    },
  });

  ctx.tools.register({
    name: 'study_resources',
    description:
      '在学校 CARSI 应用资源目录里找能用的东西（数据库、数据平台、AI 工具、课程、专利），按任务类型推荐，并说明入口在哪、要不要学校已购。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task: { type: 'string', enum: [...TASKS], description: `任务类型：${TASKS.map((task) => `${task}=${TASK_NAME[task]}`).join('，')}` },
        query: { type: 'string', description: '关键词，比如「知网」「基因」「分区」。' },
        access: { type: 'string', enum: ['subscription', 'free', 'trial'], description: '只看某一类：subscription=学校已购，free=免费，trial=试用。' },
        limit: { type: 'integer', description: '最多返回多少条，默认 8。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          total: number;
          resources: Array<{ name: string; provider: string; access: string; category: string; coverage?: string; note?: string; url?: string; hint: string }>;
        };
        const head = `资源目录共 ${result.total} 条（学校视角，标签来自 CARSI 门户与图书馆订购清单，可能变化）。`;
        if (result.resources.length === 0) return text(head, '没有匹配的条目，换个关键词试试。');
        const blocks = result.resources.map(
          (resource, index) =>
            `${index + 1}. ${resource.name}（${resource.provider}｜${ACCESS_NAME[resource.access] ?? resource.access}｜${resource.category}）\n   ${resource.coverage ?? ''}${resource.note === undefined ? '' : `\n   备注：${resource.note}`}${resource.url === undefined ? '' : `\n   地址：${resource.url}`}\n   ${resource.hint}`,
        );
        return text(head, '', ...blocks);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const limit = readNumber(args, 'limit') ?? 8;
      const query = readString(args, 'query');
      const task = readString(args, 'task');
      const access = readString(args, 'access');
      const summary = catalogSummary();
      const picked =
        query !== undefined
          ? findResources(query, {
              limit,
              ...(access === undefined ? {} : { access: access as 'subscription' | 'free' | 'trial' }),
            })
          : task !== undefined && (TASKS as readonly string[]).includes(task)
            ? recommendResources(task as (typeof TASKS)[number]).slice(0, limit)
            : findResources('', { limit });
      return {
        total: summary.total,
        resources: picked.map((resource) => ({
          name: resource.name,
          provider: resource.provider,
          access: resource.access,
          category: resource.category,
          ...(resource.coverage === undefined ? {} : { coverage: resource.coverage }),
          ...(resource.note === undefined ? {} : { note: resource.note }),
          ...(resource.url === undefined ? {} : { url: resource.url }),
          hint: openHint(resource),
        })),
      };
    },
  });

  ctx.tools.register({
    name: 'study_search_formula',
    description:
      '把研究问题翻译成数据库能直接粘贴的检索式（PubMed / Web of Science / CNKI 专业检索 / Europe PMC），含同义词组、年份与文献类型限定。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        database: { type: 'string', enum: ['pubmed', 'wos', 'cnki', 'europepmc'], description: '目标数据库。' },
        keywords: { type: 'array', items: { type: 'string' }, description: '核心关键词，按重要性排序。' },
        synonymGroups: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: '同义词组：每组内部是 OR 关系，比如 [["脑卒中","中风"],["机器学习","深度学习"]]。',
        },
        fromYear: { type: 'integer', description: '起始年份。' },
        toYear: { type: 'integer', description: '结束年份。' },
        types: {
          type: 'array',
          items: { type: 'string', enum: ['review', 'rct', 'meta', 'clinical'] },
          description: '文献类型：review=综述，rct=随机对照试验，meta=meta 分析，clinical=临床试验。',
        },
      },
      required: ['database', 'keywords'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as { database: string; formula: string; notes: string[] };
        return text(`【${result.database}】检索式：`, '', result.formula, result.notes.length > 0 ? '' : undefined, ...result.notes.map((note) => `· ${note}`));
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const database = requireString(args, 'database', 'pubmed / wos / cnki / europepmc') as 'pubmed' | 'wos' | 'cnki' | 'europepmc';
      const keywords = (readArray(args, 'keywords') ?? []).filter((item): item is string => typeof item === 'string' && item.trim() !== '');
      if (keywords.length === 0) throw new Error('keywords 至少要有一个词。');
      const synonymGroups = (readArray(args, 'synonymGroups') ?? [])
        .map((group) => (Array.isArray(group) ? group.filter((item): item is string => typeof item === 'string') : []))
        .filter((group) => group.length > 0);
      const types = (readArray(args, 'types') ?? []).filter((item): item is string => typeof item === 'string');
      const fromYear = readNumber(args, 'fromYear');
      const toYear = readNumber(args, 'toYear');
      const result = buildSearchFormula({
        database,
        keywords,
        ...(synonymGroups.length === 0 ? {} : { synonymGroups }),
        ...(fromYear === undefined ? {} : { fromYear }),
        ...(toYear === undefined ? {} : { toYear }),
        ...(types.length === 0 ? {} : { types: types as Array<'review' | 'rct' | 'meta' | 'clinical'> }),
      });
      return { database: result.database, formula: result.formula, notes: result.notes };
    },
  });
}