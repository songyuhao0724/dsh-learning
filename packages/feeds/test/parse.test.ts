import { describe, expect, it } from 'vitest';
import { detectFormat, parseFeed } from '../src/parse.js';
import { FEED_SOURCES, sourceById } from '../src/sources.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Nature Methods</title>
  <item>
    <title><![CDATA[Single-cell &amp; spatial: a new atlas]]></title>
    <link>https://www.nature.com/articles/s41592-026-01234-5</link>
    <description><![CDATA[<p>We build a <b>spatial</b> atlas of 1.2 million cells.</p>]]></description>
    <pubDate>Mon, 17 Nov 2026 10:00:00 GMT</pubDate>
    <guid isPermaLink="false">nbt-1234</guid>
  </item>
  <item>
    <title>No date, no link</title>
    <description>short</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>PLOS Computational Biology</title>
  <entry>
    <id>tag:plos,2026:pcbi.1014955</id>
    <title>Epidemic control under incomplete observations</title>
    <link rel="alternate" type="text/html" href="https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1014955"/>
    <link rel="edit" href="https://journals.plos.org/edit"/>
    <summary>Mechanistic state reconstruction reduces infection cost by 88%.</summary>
    <published>2026-11-16T14:00:00Z</published>
    <updated>2026-11-17T01:02:03Z</updated>
  </entry>
</feed>`;

const source = sourceById('nature-methods') ?? FEED_SOURCES[0];
if (source === undefined) throw new Error('信源注册表是空的');

describe('parseFeed', () => {
  it('识别 RSS 并取出标题/链接/摘要/时间', () => {
    expect(detectFormat(RSS)).toBe('rss');
    const items = parseFeed(RSS, source);
    expect(items).toHaveLength(2);
    const first = items[0];
    expect(first?.title).toBe('Single-cell & spatial: a new atlas');
    expect(first?.url).toBe('https://www.nature.com/articles/s41592-026-01234-5');
    expect(first?.summary).toBe('We build a spatial atlas of 1.2 million cells.');
    expect(first?.publishedAt).toBe('2026-11-17T10:00:00.000Z');
    expect(first?.id).toBe('nbt-1234');
    expect(first?.sourceId).toBe('nature-methods');
  });

  it('缺失字段留空而不是猜，但给一个稳定 ID', () => {
    const items = parseFeed(RSS, source);
    const second = items[1];
    expect(second?.title).toBe('No date, no link');
    expect(second?.url).toBe('');
    expect(second?.publishedAt).toBeUndefined();
    expect(second?.id).toMatch(/^nature-methods:[a-z0-9]+$/);
    // 重抓同一文档，ID 不变
    expect(parseFeed(RSS, source)[1]?.id).toBe(second?.id);
  });

  it('识别 Atom，优先 rel=alternate 的链接', () => {
    expect(detectFormat(ATOM)).toBe('atom');
    const items = parseFeed(ATOM, source);
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1014955');
    expect(items[0]?.publishedAt).toBe('2026-11-16T14:00:00.000Z');
    expect(items[0]?.id).toBe('tag:plos,2026:pcbi.1014955');
    expect(items[0]?.summary).toBe('Mechanistic state reconstruction reduces infection cost by 88%.');
  });

  it('不是 feed 就返回空数组', () => {
    expect(detectFormat('<html><body>Just a moment...</body></html>')).toBe('unknown');
    expect(parseFeed('<html><body>Just a moment...</body></html>', source)).toEqual([]);
  });

  it('同一个 id 只保留第一次出现', () => {
    const duplicated = RSS.replace('<title>No date, no link</title>', '<title>Dup</title><guid>nbt-1234</guid>');
    expect(parseFeed(duplicated, source)).toHaveLength(1);
  });

  it('按发布时间倒序，没日期的排最后', () => {
    const older = RSS.replace('Mon, 17 Nov 2026', 'Mon, 10 Nov 2026');
    const items = parseFeed(older, source);
    expect(items.map((entry) => entry.title)).toEqual([
      'Single-cell & spatial: a new atlas',
      'No date, no link',
    ]);
    expect(items[0]?.publishedAt).toBe('2026-11-10T10:00:00.000Z');
  });
});