import type { FeedSource, RawFeedItem } from './types.js';
import { clip, decodeEntities, isoDate, stripHtml, xmlAttr, xmlTag } from './xml.js';

const MAX_SUMMARY = 500;

/** 摘要里常混着 CDATA 与内联样式，先还原成纯文本。 */
function textOf(fragment: string | undefined): string {
  if (fragment === undefined) return '';
  return stripHtml(fragment.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function atomUrl(block: string): string {
  const links = [...block.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const alternate = links.find((tag) => /rel\s*=\s*["']alternate["']/i.test(tag));
  const picked = alternate ?? links.find((tag) => !/rel\s*=\s*["'](self|edit|enclosure|replies)["']/i.test(tag));
  if (picked !== undefined) {
    const href = xmlAttr(picked, 'href');
    if (href !== undefined && href !== '') return href;
  }
  const id = textOf(xmlTag(block, 'id'));
  return /^https?:\/\//i.test(id) ? id : '';
}

function rssUrl(block: string): string {
  const link = textOf(xmlTag(block, 'link'));
  if (/^https?:\/\//i.test(link)) return link;
  const guid = textOf(xmlTag(block, 'guid'));
  return /^https?:\/\//i.test(guid) ? guid : '';
}

/** 没有 guid/link 时用「源 + 标题」算一个稳定 ID，保证重抓时不会重复入库。 */
function fallbackId(source: FeedSource, title: string): string {
  let hash = 2166136261;
  for (let i = 0; i < title.length; i += 1) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.id}:${(hash >>> 0).toString(36)}`;
}

export type FeedFormat = 'rss' | 'atom' | 'unknown';

export function detectFormat(xml: string): FeedFormat {
  if (/<entry\b/i.test(xml)) return 'atom';
  if (/<item\b/i.test(xml)) return 'rss';
  return 'unknown';
}

/**
 * 把一份 RSS/Atom 文档解析成条目列表。字段缺失就留空，不猜。
 * 同一个 id 只保留第一次出现的形态（跨源去重交给数据库）。
 */
export function parseFeed(xml: string, source: FeedSource): RawFeedItem[] {
  const format = detectFormat(xml);
  if (format === 'unknown') return [];
  const atom = format === 'atom';
  const blockRe = atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi;
  const items: RawFeedItem[] = [];
  const seen = new Set<string>();

  for (const match of xml.matchAll(blockRe)) {
    const block = match[0];
    const title = textOf(xmlTag(block, 'title'));
    if (title === '') continue;
    const url = atom ? atomUrl(block) : rssUrl(block);
    const guid = atom ? textOf(xmlTag(block, 'id')) : textOf(xmlTag(block, 'guid'));
    const rawId = guid !== '' ? guid : url;
    const id = (rawId !== '' ? rawId : fallbackId(source, title)).replace(/\s+/g, ' ').trim();
    if (seen.has(id)) continue;
    seen.add(id);

    const rawSummary = atom
      ? xmlTag(block, 'summary') ?? xmlTag(block, 'content')
      : xmlTag(block, 'description') ?? xmlTag(block, 'content:encoded');
    const publishedAt = atom
      ? isoDate(textOf(xmlTag(block, 'published')) || textOf(xmlTag(block, 'updated')))
      : isoDate(textOf(xmlTag(block, 'pubDate')) || textOf(xmlTag(block, 'dc:date')));

    items.push({
      id,
      sourceId: source.id,
      title: clip(decodeEntities(title), 300),
      summary: clip(textOf(rawSummary), MAX_SUMMARY),
      url,
      ...(publishedAt === undefined ? {} : { publishedAt }),
      topics: source.topics,
    });
  }

  return items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}