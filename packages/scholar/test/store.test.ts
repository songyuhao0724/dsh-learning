import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScholarStore } from '../src/store.js';

const PAPER_A = [
  '深度学习在康复医学中的应用',
  '本文讨论了卷积神经网络在脑卒中患者运动功能评估中的应用，模型在 320 例样本上达到 0.91 的 AUC。',
  '本研究采用十折交叉验证，并与传统量表评估结果进行一致性分析。',
];

const PAPER_B = [
  '生物信息学中的序列比对',
  '基于 Smith-Waterman 的局部比对算法在大规模基因组数据上的性能优化。',
  '我们提出一种基于索引的加速策略，将比对耗时降低 40%。',
];

const PAPER_C = [
  '肿瘤免疫治疗的进展',
  'PD-1 抑制剂联合化疗显著改善非小细胞肺癌患者的无进展生存期。',
  '本文综述了近年来免疫检查点抑制剂的临床试验结果。',
];

function seed(store: ScholarStore): void {
  for (const [docKey, pages] of Object.entries({ A: PAPER_A, B: PAPER_B, C: PAPER_C })) {
    pages.forEach((text, index) => {
      store.upsertChunks([
        { docKey, page: index + 1, text, meta: { title: pages[0], tag: docKey } },
      ]);
    });
  }
}

describe('ScholarStore', () => {
  let store: ScholarStore;

  beforeEach(() => {
    store = new ScholarStore(':memory:');
    seed(store);
  });

  afterEach(() => {
    store.close();
  });

  it('统计正确的分块与文献数', () => {
    expect(store.stats()).toEqual({ chunks: 9, documents: 3 });
  });

  it('中文短语查询命中正确文献', () => {
    const hits = store.search('卷积神经网络');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.docKey).toBe('A');
    expect(hits[0]?.page).toBe(2);
    expect(hits[0]?.snippet).toContain('[卷积神经网络]');
    expect(hits[0]?.meta.title).toBe(PAPER_A[0]);
  });

  it('三个字的医学词（脑卒中）能命中', () => {
    const hits = store.search('脑卒中');
    expect(hits.map((h) => h.docKey)).toEqual(['A']);
  });

  it('英文缩写（AUC）能命中', () => {
    const hits = store.search('AUC');
    expect(hits.map((h) => h.docKey)).toEqual(['A']);
  });

  it('带连字符的英文词（PD-1）能命中', () => {
    const hits = store.search('PD-1');
    expect(hits.map((h) => h.docKey)).toEqual(['C']);
  });

  it('不存在的词返回空数组', () => {
    expect(store.search('量子色动力学')).toEqual([]);
  });

  it('单字查询走 LIKE 兜底也能命中', () => {
    const hits = store.search('癌');
    expect(hits.map((h) => h.docKey)).toEqual(['C']);
  });

  it('标点切断汉字串时，宽松模式仍能召回', () => {
    const strict = store.search('卷积神经网络', { mode: 'strict' });
    expect(strict.length).toBeGreaterThan(0);

    store.upsertChunks([
      { docKey: 'D', page: 1, text: '我们验证了卷积，神经网络在影像分割上的效果。' },
    ]);
    const fuzzy = store.search('卷积神经网络', { limit: 10 });
    expect(fuzzy.map((h) => h.docKey)).toContain('D');
  });

  it('同一 (docKey, page) 重复写入是覆盖而非追加', () => {
    store.upsertChunks([{ docKey: 'A', page: 2, text: '改写后的内容，只保留脑卒中三个字。' }]);
    expect(store.stats().chunks).toBe(9);
    const hits = store.search('卷积神经网络');
    expect(hits).toEqual([]);
    expect(store.search('脑卒中').map((h) => h.docKey)).toEqual(['A']);
  });

  it('删除文献后不再被检索到', () => {
    expect(store.removeDocument('C')).toBe(3);
    expect(store.stats()).toEqual({ chunks: 6, documents: 2 });
    expect(store.search('PD-1')).toEqual([]);
  });

  it('limit 生效且结果按相关度排序', () => {
    const hits = store.search('基因组 比对', { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits[0]?.docKey).toBe('B');
  });
});