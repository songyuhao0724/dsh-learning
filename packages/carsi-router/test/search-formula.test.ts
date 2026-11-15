import { describe, expect, it } from 'vitest';
import { buildSearchFormula } from '../src/search-formula.js';

describe('检索式生成', () => {
  it('PubMed：题名/摘要 + 出版类型 + 年份区间', () => {
    const result = buildSearchFormula({
      database: 'pubmed',
      keywords: ['脑卒中', '康复'],
      fromYear: 2020,
      toYear: 2025,
      types: ['review'],
    });
    expect(result.formula).toBe(
      '("脑卒中"[Title/Abstract] OR "康复"[Title/Abstract])' +
        ' AND (2020/01/01[Date - Publication] : 2025/12/31[Date - Publication])' +
        ' AND (review[pt])',
    );
    expect(result.notes.join('\n')).toContain('[pt]');
  });

  it('PubMed：同义词组内部 OR、组间 AND', () => {
    const result = buildSearchFormula({
      database: 'pubmed',
      keywords: ['脑卒中'],
      synonymGroups: [['stroke', 'cerebrovascular accident']],
    });
    expect(result.formula).toBe(
      '"脑卒中"[Title/Abstract] AND ("stroke"[Title/Abstract] OR "cerebrovascular accident"[Title/Abstract])',
    );
  });

  it('CNKI：专业检索语法 SU= 与 * / +', () => {
    const result = buildSearchFormula({
      database: 'cnki',
      keywords: ['卷积神经网络', '脑卒中'],
      fromYear: 2021,
    });
    expect(result.formula).toBe("(SU='卷积神经网络' + SU='脑卒中')");
    // 年份交给界面的筛选器，不写进公式
    expect(result.notes.join('\n')).toContain('左侧筛选器');
  });

  it('Web of Science：TS + PY + DT', () => {
    const result = buildSearchFormula({
      database: 'wos',
      keywords: ['lung cancer'],
      fromYear: 2021,
      toYear: 2024,
      types: ['review'],
    });
    expect(result.formula).toBe('TS=("lung cancer") AND PY=(2021-2024) AND DT=(Review)');
  });

  it('Europe PMC：PUB_YEAR 区间', () => {
    const result = buildSearchFormula({
      database: 'europepmc',
      keywords: ['肺癌'],
      fromYear: 2021,
      toYear: 2024,
    });
    expect(result.formula).toBe('"肺癌" AND (PUB_YEAR:[2021 TO 2024])');
  });

  it('单年筛选：toYear 缺省时用 fromYear', () => {
    const result = buildSearchFormula({ database: 'wos', keywords: ['x'], fromYear: 2023 });
    expect(result.formula).toContain('PY=(2023-2023)');
  });

  it('关键词为空时报错而不是生成空式子', () => {
    expect(() => buildSearchFormula({ database: 'pubmed', keywords: ['  '] })).toThrow('至少要给一个关键词');
  });

  it('引号会被转义，避免破坏检索式', () => {
    const result = buildSearchFormula({ database: 'pubmed', keywords: ['say "hi"'] });
    expect(result.formula).toBe('"say ""hi"""[Title/Abstract]');
  });
});