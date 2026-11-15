/**
 * 中文检索的分词策略：**重叠二元组（bigram）**，不依赖任何分词器。
 *
 * 为什么这么做（已实测）：
 * - SQLite 自带的 `unicode61` 分词器不切中文，整段中文会被当成极少几个 token，
 *   导致「康复」「神经网络」这类查询 0 命中。
 * - `node:sqlite` 不支持注册自定义分词器（那是 SQLite C API 的能力）。
 * - `Intl.Segmenter('zh', { granularity: 'word' })` 依赖 ICU 词典，实测把
 *   「卷积」切成「卷|积」，切分质量不稳定，不适合做检索主键。
 *
 * 解法：索引时把连续汉字切成**重叠二字组**（卷积神经网络 → 卷积/积神/神经/经网/网络），
 * 查询时把中文查询词同样切成二字组并用 FTS5 的**短语匹配**（要求 token 位置相邻）
 * 还原原词，既不丢召回也不会把「神经网络」错配成「神经 + 网络」的任意组合。
 */

/** 是否汉字（含扩展 A、兼容区）。 */
const HAN = /\p{Script=Han}/u;
const HAN_CHAR = /^\p{Script=Han}$/u;
const ALNUM = /[A-Za-z0-9]/;

/** 二维切分的最小单位：一段连续汉字能切出的重叠二元组个数。 */
export const MIN_BIGRAM_RUN = 2;

/**
 * 把一段文本转成索引 token 序列。
 *
 * - 连续汉字：切成重叠 2-gram；长度为 1 的孤立汉字保留为单 token。
 * - 连续英数：整体转小写作为一个 token（`PD-1` 中的 `-` 是分隔符，得到 `pd`、`1`）。
 * - 其他字符（标点、空白）：丢弃。
 */
export function tokenizeText(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i] as string;

    if (HAN.test(ch)) {
      let j = i;
      while (j < n && HAN.test(text[j] as string)) j += 1;
      const run = text.slice(i, j);
      if (run.length < MIN_BIGRAM_RUN) {
        tokens.push(run);
      } else {
        for (let k = 0; k + MIN_BIGRAM_RUN <= run.length; k += 1) {
          tokens.push(run.slice(k, k + MIN_BIGRAM_RUN));
        }
      }
      i = j;
      continue;
    }

    if (ALNUM.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(text[j] as string)) j += 1;
      tokens.push(text.slice(i, j).toLowerCase());
      i = j;
      continue;
    }

    i += 1;
  }

  return tokens;
}

/** 索引用的 token 串：FTS5 的 unicode61 会按空格重新切，所以用单空格连接。 */
export function toIndexable(text: string): string {
  return tokenizeText(text).join(' ');
}

function quoteToken(token: string): string {
  // 纯小写字母/数字/下划线可以裸写；其余情况用双引号包成短语（内部引号翻倍转义）。
  if (/^[a-z0-9_]+$/.test(token)) return token;
  return `"${token.replace(/"/g, '""')}"`;
}

function phrase(tokens: string[]): string {
  if (tokens.length === 1) return quoteToken(tokens[0] as string);
  return `"${tokens.join(' ')}"`;
}

export interface QueryPlan {
  /**
   * 严格表达式：每个查询词转成短语，词之间 AND。
   * 例如 `卷积 神经网络` → `卷积 AND "神经 经网 网络"`。为 null 表示纯单字查询。
   */
  fts: string | null;
  /**
   * 宽松表达式：把严格表达式的所有 token 用 OR 连起来。
   * 用途：中文标点会把汉字串切断（`卷积，神经网络` 少一个「积神」二元组），
   * 严格短语匹配会 0 命中；此时退回 OR 仍能按 bm25 找回相关段落。
   */
  relaxed: string | null;
  /** 只能靠 LIKE 兜底的单字查询（单字没有二元组可用）。 */
  singleChars: string[];
  /** 查询里出现的原始词，用于生成高亮片段。 */
  terms: string[];
}

/** 把用户输入解析成 FTS5 查询计划。 */
export function planQuery(query: string): QueryPlan {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const strict: string[] = [];
  const allTokens: string[] = [];
  const singleChars: string[] = [];

  for (const term of terms) {
    if (term.length === 1 && HAN_CHAR.test(term)) {
      singleChars.push(term);
      continue;
    }
    const tokens = tokenizeText(term);
    if (tokens.length === 0) continue;
    strict.push(phrase(tokens));
    allTokens.push(...tokens);
  }

  return {
    fts: strict.length > 0 ? strict.join(' AND ') : null,
    relaxed: allTokens.length > 0 ? allTokens.map(quoteToken).join(' OR ') : null,
    singleChars,
    terms,
  };
}

export interface SnippetOptions {
  /** 命中点之前保留的字符数。 */
  before?: number;
  /** 命中点之后保留的字符数。 */
  after?: number;
}

/**
 * 从正文里截取命中上下文，并把**原始查询词**（而非二元组）用方括号标出。
 *
 * 不用 FTS5 的 `snippet()`：索引里存的是二元组，标出来的会是一堆碎片；
 * 这里拿原文自己找、自己标，输出对人可读。
 */
export function makeSnippet(text: string, terms: string[], options: SnippetOptions = {}): string {
  const before = options.before ?? 60;
  const after = options.after ?? 120;
  const flat = text.replace(/\s+/g, ' ').trim();

  const lowered = flat.toLowerCase();
  let hitAt = -1;
  let hitLen = 0;
  for (const term of terms) {
    if (!term) continue;
    const idx = lowered.indexOf(term.toLowerCase());
    if (idx >= 0 && (hitAt < 0 || idx < hitAt)) {
      hitAt = idx;
      hitLen = term.length;
    }
  }

  if (hitAt < 0) {
    return flat.length <= before + after ? flat : `${flat.slice(0, before + after)}…`;
  }

  const start = Math.max(0, hitAt - before);
  const end = Math.min(flat.length, hitAt + hitLen + after);
  let window = flat.slice(start, end);

  // 从后往前标，避免前面的插入改动后面的下标。
  const marks: Array<[number, number]> = [];
  const windowLower = window.toLowerCase();
  for (const term of terms) {
    if (!term) continue;
    const needle = term.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = windowLower.indexOf(needle, from);
      if (idx < 0) break;
      marks.push([idx, idx + needle.length]);
      from = idx + needle.length;
    }
  }
  marks.sort((a, b) => b[0] - a[0]);
  for (const [s, e] of marks) {
    window = `${window.slice(0, s)}[${window.slice(s, e)}]${window.slice(e)}`;
  }

  return `${start > 0 ? '…' : ''}${window}${end < flat.length ? '…' : ''}`;
}