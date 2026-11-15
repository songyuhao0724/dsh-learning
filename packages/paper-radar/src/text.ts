/** 抓取时共用的文本工具：不引第三方 XML/HTML 库。 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&[a-z#0-9]+;/gi, (match) => ENTITIES[match.toLowerCase()] ?? match);
}

/** 折叠空白、去标签，得到适合做摘要与打标的纯文本。 */
export function plainText(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** 取 XML 里第一个同名标签的内容（带命名空间前缀也能匹配）。 */
export function xmlTag(block: string, name: string): string | undefined {
  const pattern = new RegExp(`<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`, 'i');
  return pattern.exec(block)?.[1];
}

/** 取 XML 里所有同名标签的内容。 */
export function xmlTags(block: string, name: string): string[] {
  const pattern = new RegExp(`<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`, 'gi');
  return [...block.matchAll(pattern)].map((match) => match[1] ?? '');
}

export function isoDate(value: string | undefined, fallback: Date): string {
  if (value === undefined || value.trim() === '') return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

/** 把「往前 N 天」变成 YYYY-MM-DD（UTC），给 bioRxiv 之类的日期区间 API 用。 */
export function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}