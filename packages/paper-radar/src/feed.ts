import { topicLabel } from './topics.js';
import type { AiHotFeed, AiHotFeedItem, RadarItem } from './types.js';

/**
 * 导出成 AIHOT 的 `json_list` 信源契约（键名照抄 AIHOT 的 docs/sources.md，
 * 那个文件里写明「填了不认识的配置项会被拒绝」，所以这里只用文档出现过的键）：
 *
 *   itemsPath = data.items
 *   titlePaths = ["title"]
 *   summaryPaths = ["summary"]
 *   publishedAtPath = "published_at"
 *   externalIdPath = "id"
 *   authorPaths = ["authors"]
 *   urlTemplate = "{raw:url}"
 */
export function toAiHotFeed(items: RadarItem[]): AiHotFeed {
  return {
    data: {
      items: items.map((item): AiHotFeedItem => ({
        id: item.id,
        title: item.title,
        summary: buildSummary(item),
        url: item.url,
        published_at: item.publishedAt,
        source: item.source,
        tags: item.topics.map((topic) => topicLabel(topic)),
        authors: item.authors.slice(0, 6).join(', '),
        ...(item.doi === undefined ? {} : { doi: item.doi }),
      })),
    },
  };
}

function buildSummary(item: RadarItem): string {
  const abstract = item.abstract.trim();
  const clipped = abstract.length > 500 ? `${abstract.slice(0, 500)}…` : abstract;
  const meta = [item.authors.slice(0, 3).join('、'), item.source].filter((part) => part !== '').join(' · ');
  return clipped === '' ? meta : `${meta}\n\n${clipped}`;
}

/**
 * 「采集配置」JSON：粘进 AIHOT 后台 /admin/sources/new 的「采集配置（JSON）」框。
 * 名称、类型（json_list）、等级（tier）是表单字段，不在这个 JSON 里。
 */
export function aihotSourceConfig(url: string): Record<string, unknown> {
  return {
    url,
    mode: 'json_api',
    itemsPath: 'data.items',
    titlePaths: ['title'],
    summaryPaths: ['summary'],
    urlTemplate: '{raw:url}',
    publishedAtPath: 'published_at',
    externalIdPath: 'id',
    authorPaths: ['authors'],
  };
}

/** 给 README/文档用的一行说明：这个端点是给谁喂数据的。 */
export function describeFeedEndpoint(items: number): string {
  return `AIHOT json_list 端点已就绪：${items} 条（itemsPath=data.items，published_at 为带时区的 ISO 字符串）。`;
}