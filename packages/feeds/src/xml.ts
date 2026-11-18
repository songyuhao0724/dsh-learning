/**
 * RSS/Atom 需要的几个纯文本小工具。
 *
 * 刻意不引第三方 XML 库：信源都是「一篇文章一个 entry/item」的列表结构，
 * 正则切分足够稳，而且零依赖能保证这个包在插件里随装随用。
 * （paper-radar 里有一份 Atom 专用的小实现，这里覆盖 RSS 0.9x/1.0/2.0/Atom 1.0。）
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  times: '×',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/** 去标签 + 解实体 + 压空白，得到能直接读的一段话。 */
export function stripHtml(input: string): string {
  const withoutBlocks = input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/** 取第一个 <tag>…</tag> 的内容（标签允许带属性）。 */
export function xmlTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return match?.[1];
}

/** 取所有同名标签的内容。 */
export function xmlTags(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  for (const match of xml.matchAll(re)) {
    if (match[1] !== undefined) out.push(match[1]);
  }
  return out;
}

/** 取一个标签片段上的属性值，例如 <link href="…"/> 里的 href。 */
export function xmlAttr(fragment: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(fragment);
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : decodeEntities(value);
}

/** 解析日期；解析不出来就当作没有日期（不猜）。 */
export function isoDate(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const text = decodeEntities(input).trim();
  if (text === '') return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** 截断到指定长度，尽量不切断英文单词。 */
export function clip(input: string, limit: number): string {
  const text = input.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space > limit * 0.6 ? cut.slice(0, space) : cut) + '…';
}