/**
 * 检索式生成：把「我想找什么」翻译成各数据库能直接粘的检索式。
 *
 * 为什么值得单独做：中文学生在知网/PubMed 上「检索不出来」，
 * 九成不是没有文献，而是检索式写错了（关键词之间用空格=AND、
 * 同义词没有 OR 展开、没有限制文献类型）。
 */
export type SearchDatabase = 'pubmed' | 'cnki' | 'wos' | 'europepmc';

export type ArticleType = 'review' | 'rct' | 'meta' | 'clinical';

export interface SearchFormulaInput {
  /** 核心关键词，必填，彼此为 AND 关系。 */
  keywords: string[];
  /** 同义词组：每组内部 OR，组与组之间 AND。 */
  synonymGroups?: string[][];
  fromYear?: number;
  toYear?: number;
  types?: ArticleType[];
  database: SearchDatabase;
}

export interface SearchFormula {
  database: SearchDatabase;
  formula: string;
  /** 每个运算符/筛选条件的中文解释，方便学生自己改。 */
  notes: string[];
}

const PUBMED_TYPE_FILTER: Record<ArticleType, string> = {
  review: 'review[pt]',
  rct: 'randomized controlled trial[pt]',
  meta: 'meta-analysis[pt]',
  clinical: 'clinical trial[pt]',
};

const WOS_TYPE_FILTER: Record<ArticleType, string> = {
  review: 'DT=(Review)',
  rct: 'DT=(Article) AND TS=(randomized OR randomised OR trial)',
  meta: 'DT=(Article) AND TS=(meta-analysis)',
  clinical: 'DT=(Article) AND TS=(clinical trial)',
};

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function group(parts: string[], separator = ' OR '): string {
  return parts.length === 1 ? parts[0]! : `(${parts.join(separator)})`;
}

function dateRange(fromYear?: number, toYear?: number): { from?: number; to?: number } {
  const from = fromYear ?? undefined;
  const to = toYear ?? from;
  return { from, to };
}

/**
 * 生成检索式。
 *
 * 只做「能直接粘进数据库检索框」的确定性改写，不替用户访问任何数据库。
 */
export function buildSearchFormula(input: SearchFormulaInput): SearchFormula {
  const keywords = input.keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);
  if (keywords.length === 0) throw new Error('至少要给一个关键词');
  const synonymGroups = (input.synonymGroups ?? []).filter((groupItems) => groupItems.length > 0);
  const { from, to } = dateRange(input.fromYear, input.toYear);
  const notes: string[] = [];
  let formula: string;

  if (input.database === 'pubmed') {
    const blocks = [
      group(keywords.map((keyword) => `${quote(keyword)}[Title/Abstract]`)),
      ...synonymGroups.map((items) => group(items.map((item) => `${quote(item)}[Title/Abstract]`))),
    ];
    formula = blocks.join(' AND ');
    notes.push('[Title/Abstract] 限定在标题与摘要里检索，避免全文噪音。');
    if (from !== undefined) {
      formula += ` AND (${from}/01/01[Date - Publication] : ${to ?? from}/12/31[Date - Publication])`;
      notes.push('日期范围用 [Date - Publication]，含两端。');
    }
    if (input.types && input.types.length > 0) {
      const filters = input.types.map((type) => PUBMED_TYPE_FILTER[type]);
      formula += ` AND (${filters.join(' OR ')})`;
      notes.push('[pt] 是出版类型筛选；review/meta-analysis 适合先建立框架。');
    }
  } else if (input.database === 'europepmc') {
    const blocks = [group(keywords.map((keyword) => quote(keyword)))];
    for (const items of synonymGroups) blocks.push(group(items.map((item) => quote(item))));
    formula = blocks.join(' AND ');
    if (from !== undefined) {
      formula += ` AND (PUB_YEAR:[${from} TO ${to ?? from}])`;
      notes.push('Europe PMC 的年份字段是 PUB_YEAR，区间用 [a TO b]。');
    }
    notes.push('Europe PMC 覆盖预印本，适合追最新进展。');
  } else if (input.database === 'wos') {
    const blocks = [group(keywords.map((keyword) => `TS=(${quote(keyword)})`))];
    for (const items of synonymGroups) blocks.push(group(items.map((item) => `TS=(${quote(item)})`)));
    formula = blocks.join(' AND ');
    notes.push('TS= 是「主题」字段（标题/摘要/关键词）。');
    if (from !== undefined) {
      formula += ` AND PY=(${from}-${to ?? from})`;
      notes.push('PY= 是出版年区间。');
    }
    if (input.types && input.types.length > 0) {
      formula += ` AND ${group(input.types.map((type) => WOS_TYPE_FILTER[type]))}`;
      notes.push('DT= 是文献类型。');
    }
  } else {
    // CNKI 专业检索：+ 为 OR、* 为 AND、- 为 NOT（全角符号亦可）
    const blocks = [group(keywords.map((keyword) => `SU='${keyword}'`), ' + ')];
    for (const items of synonymGroups) blocks.push(group(items.map((item) => `SU='${item}'`), ' + '));
    formula = blocks.join(' * ');
    notes.push("SU= 是「主题」；+ 表示 OR、* 表示 AND（知网专业检索语法）。");
    if (from !== undefined) {
      notes.push(`年份请在知网左侧筛选器里选 ${from}–${to ?? from} 年（专业检索式里写年份容易因库而失效）。`);
    }
  }

  return { database: input.database, formula, notes };
}