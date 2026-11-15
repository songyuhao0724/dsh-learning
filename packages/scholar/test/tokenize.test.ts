import { describe, expect, it } from 'vitest';
import { makeSnippet, planQuery, tokenizeText } from '../src/tokenize.js';

describe('tokenizeText', () => {
  it('把连续汉字切成重叠二元组', () => {
    expect(tokenizeText('卷积神经网络')).toEqual(['卷积', '积神', '神经', '经网', '网络']);
  });

  it('保留孤立汉字（无法成组时）', () => {
    expect(tokenizeText('癌')).toEqual(['癌']);
    // 「做脑卒中预测」是一整段连续汉字，所以二元组会跨词边界（做脑、中预），
    // 这是 bigram 方案的固有代价：召回优先，靠短语匹配保证精度。
    expect(tokenizeText('用 CNN 做脑卒中预测')).toEqual([
      '用',
      'cnn',
      '做脑',
      '脑卒',
      '卒中',
      '中预',
      '预测',
    ]);
  });

  it('英文与数字转小写，连字符当分隔符', () => {
    expect(tokenizeText('PD-1')).toEqual(['pd', '1']);
    expect(tokenizeText('AUC 0.91')).toEqual(['auc', '0', '91']);
  });

  it('空串与纯标点返回空数组', () => {
    expect(tokenizeText('')).toEqual([]);
    expect(tokenizeText('，。！？')).toEqual([]);
  });
});

describe('planQuery', () => {
  it('中文查询词转成二元组短语', () => {
    expect(planQuery('卷积神经网络').fts).toBe('"卷积 积神 神经 经网 网络"');
  });

  it('两个字的词退化为单个 token（仍加引号以防被当成操作符）', () => {
    expect(planQuery('肺癌').fts).toBe('"肺癌"');
  });

  it('多词用 AND 连接', () => {
    expect(planQuery('卷积 神经网络').fts).toBe('"卷积" AND "神经 经网 网络"');
  });

  it('单字查询没有二元组，走 LIKE 兜底', () => {
    const plan = planQuery('癌');
    expect(plan.fts).toBeNull();
    expect(plan.singleChars).toEqual(['癌']);
  });

  it('带连字符的英文词被拆成相邻 token 的短语', () => {
    // 回归测试：直接裸写 pd-1 会让 FTS5 解析成「列名 pd 减 1」而报 no such column。
    expect(planQuery('PD-1').fts).toBe('"pd 1"');
  });

  it('宽松表达式是全部 token 的 OR', () => {
    expect(planQuery('肺癌').relaxed).toBe('"肺癌"');
    expect(planQuery('脑卒中').relaxed).toBe('"脑卒" OR "卒中"');
  });

  it('纯标点查询返回空计划', () => {
    const plan = planQuery('，。');
    expect(plan.fts).toBeNull();
    expect(plan.relaxed).toBeNull();
    expect(plan.singleChars).toEqual([]);
  });
});

describe('makeSnippet', () => {
  it('截取命中上下文并标注原始查询词', () => {
    const text = `${'背景'.repeat(80)}本文提出一种卷积神经网络方法用于康复评估。${'讨论'.repeat(80)}`;
    const snippet = makeSnippet(text, ['卷积神经网络']);
    expect(snippet).toContain('[卷积神经网络]');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThan(text.length);
  });

  it('没有命中时退化为开头截断', () => {
    expect(makeSnippet('无关内容', ['卷积'])).toBe('无关内容');
  });

  it('多个词都被标注', () => {
    const snippet = makeSnippet('肺癌患者使用 PD-1 抑制剂', ['肺癌', 'PD-1']);
    expect(snippet).toContain('[肺癌]');
    expect(snippet).toContain('[PD-1]');
  });
});