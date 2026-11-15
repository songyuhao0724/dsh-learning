import { cngbDeepLinks, searchGeo, searchSra } from '@dsh-learning/bio-data';
import { readNumber, readString, requireString, text } from '../args.js';
import type { PluginContext, ToolsConfig } from '../types.js';

const OBJECT = { type: 'object' } as const;

/** 科研数据工具：GEO / SRA 检索，CNGBdb 等国内平台给深链。 */
export function registerBioDataTools(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_bio_data_search',
    description:
      '检索公共科研数据：NCBI GEO 数据集（GSE）、SRA 研究（SRP），或给出 CNGBdb / CNSA / GSA 国内平台的门户深链。返回标题、摘要、物种、样本数和可点开的链接。需要联网。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'term'],
      properties: {
        source: {
          type: 'string',
          enum: ['geo', 'sra', 'cngbdb'],
          description: 'geo=数据集（GSE）；sra=测序研究（SRP）；cngbdb=国内平台深链。',
        },
        term: { type: 'string', description: '检索词，例如 single-cell lung cancer；GEO 支持字段语法。' },
        limit: { type: 'number', description: '返回条数，默认 8。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          source: string;
          count: number;
          items: Array<{
            accession: string;
            title: string;
            url: string;
            organism?: string;
            studyType?: string;
            samples?: number;
            runs?: number;
            summary?: string;
          }>;
          warnings: string[];
          links?: Array<{ name: string; url: string; note: string }>;
        };
        if (result.links !== undefined) {
          return text(
            `国内平台没有公开检索接口，下面是带着关键词的深链（点开即是结果页）：`,
            ...result.links.map((link) => `- ${link.name}：${link.url}\n  ${link.note}`),
          );
        }
        const lines: Array<string | undefined> = [`${result.source.toUpperCase()} 命中共 ${result.count} 条，列出 ${result.items.length} 条：`];
        for (const item of result.items) {
          const facts = [
            item.organism,
            item.studyType,
            item.samples === undefined ? undefined : `${item.samples} 个样本`,
            item.runs === undefined ? undefined : `${item.runs} 个 Run`,
          ].filter((fact): fact is string => fact !== undefined);
          lines.push(`- ${item.accession}｜${item.title}${facts.length === 0 ? '' : `（${facts.join('，')}）`}\n  ${item.url}`);
          if (item.summary !== undefined && item.summary !== '') lines.push(`  ${item.summary.slice(0, 200)}${item.summary.length > 200 ? '…' : ''}`);
        }
        if (result.warnings.length > 0) lines.push(`注意：${result.warnings.join('；')}`);
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const source = requireString(args, 'source', 'geo / sra / cngbdb 三选一');
      const term = requireString(args, 'term', '例如 single-cell lung cancer');
      const limit = readNumber(args, 'limit') ?? 8;
      const fetcher = config.fetch;
      if (source === 'cngbdb') {
        return { source, count: 0, items: [], warnings: [], links: cngbDeepLinks(term) };
      }
      if (source !== 'geo' && source !== 'sra') {
        throw new Error(`不认识的 source：${source}（只能是 geo / sra / cngbdb）`);
      }
      if (fetcher === undefined) {
        throw new Error('这个环境没有可用的 fetch，无法联网检索；请检查网络或在插件配置里注入 fetch。');
      }
      const email = readString(args, 'email') ?? config.contactEmail;
      const identity = { tool: 'dsh-learning', ...(email === undefined ? {} : { email }) };
      if (source === 'geo') {
        const result = await searchGeo({ term, maxResults: limit, identity, fetch: fetcher });
        return { ...result, items: result.items };
      }
      const result = await searchSra({ term, maxResults: limit, identity, fetch: fetcher });
      return { ...result, items: result.items };
    },
  });
}