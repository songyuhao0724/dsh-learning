import { aihotSourceConfig, collectRadar, toAiHotFeed, topicLabel } from '@dsh-learning/paper-radar';
import { readNumber, readString, text } from '../args.js';
import type { PluginContext, ToolsConfig } from '../types.js';

const OBJECT = { type: 'object' } as const;

function readStringArray(args: unknown, key: string): string[] | undefined {
  const value = (args as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return items.length === 0 ? undefined : items;
}

/** 热点论文工具：抓一轮 → 打标 → 给模型可读清单 + 可直接粘进 AIHOT 的 feed。 */
export function registerRadarTools(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_papers_radar',
    description:
      '抓取 arXiv / bioRxiv / medRxiv / PubMed 最近几天的论文，按内置主题（医学 AI、基因组、生信方法、精准医学、神经、公共卫生、临床试验、康复）打标去重，并给出可直接接入 AIHOT 热点站的 feed JSON。需要联网。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: '只要这些主题：用 id（medical-ai、genomics…）或中文标签（基因组与组学…）都行；不传则全部。',
        },
        days: { type: 'number', description: '往前看几天，默认 7。' },
        perSource: { type: 'number', description: '每个源最多抓几条，默认 20。' },
        query: { type: 'string', description: '主题检索词；给了才会额外查 PubMed，例如 single-cell lung cancer。' },
        limit: { type: 'number', description: '清单里最多显示几条，默认 10。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          count: number;
          items: Array<{ title: string; source: string; publishedAt: string; topics: string[]; url: string }>;
          perSource: Record<string, number>;
          warnings: string[];
        };
        const lines: Array<string | undefined> = [
          `抓到 ${result.count} 篇（${Object.entries(result.perSource).map(([name, count]) => `${name} ${count}`).join('，')}）。`,
        ];
        for (const item of result.items) {
          const tags = item.topics.length === 0 ? '未分类' : item.topics.join('、');
          lines.push(`- [${tags}] ${item.title}\n  ${item.source}｜${item.publishedAt.slice(0, 10)}｜${item.url}`);
        }
        if (result.warnings.length > 0) lines.push(`注意：${result.warnings.join('；')}`);
        lines.push('想做成长期信源：用 `dsh-radar export --out radar.json` 生成 JSON，再把它放到静态地址，按返回里的 aihot 配置加进 AIHOT（类型 json_list / mode json_api）。');
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const topics = readStringArray(args, 'topics');
      const query = readString(args, 'query');
      const result = await collectRadar({
        ...(topics === undefined ? {} : { topics }),
        ...(query === undefined ? {} : { query }),
        days: readNumber(args, 'days') ?? 7,
        perSource: readNumber(args, 'perSource') ?? 20,
        ...(config.fetch === undefined ? {} : { fetch: config.fetch }),
      });
      const limit = readNumber(args, 'limit') ?? 10;
      const items = result.items.slice(0, limit).map((item) => ({
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        topics: item.topics.map((topic) => topicLabel(topic)),
        url: item.url,
        authors: item.authors,
        ...(item.doi === undefined ? {} : { doi: item.doi }),
      }));
      return {
        count: result.items.length,
        items,
        perSource: result.perSource,
        warnings: result.warnings,
        aihot: aihotSourceConfig('https://example.com/radar.json'),
        feed: toAiHotFeed(result.items.slice(0, limit)),
      };
    },
  });
}