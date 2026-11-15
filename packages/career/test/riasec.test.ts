import { describe, expect, it } from 'vitest';
import {
  describeProfile,
  matchOccupations,
  RIASEC_ITEMS,
  scoreRiasec,
} from '../src/riasec.js';
import type { RiasecAnswers } from '../src/types.js';
import { OCCUPATIONS } from '../src/data/occupations.js';

function answersWith(value: number, overrides: Record<string, number> = {}): RiasecAnswers {
  const answers: RiasecAnswers = {};
  for (const item of RIASEC_ITEMS) answers[item.id] = value;
  return { ...answers, ...overrides };
}

describe('RIASEC 测评', () => {
  it('全部选 5 分时每维都是 100', () => {
    const profile = scoreRiasec(answersWith(5));
    for (const value of Object.values(profile.scores)) expect(value).toBe(100);
    expect(profile.top).toHaveLength(6);
  });

  it('全部选 1 分时每维都是 0', () => {
    const profile = scoreRiasec(answersWith(1));
    for (const value of Object.values(profile.scores)) expect(value).toBe(0);
  });

  it('单独抬高某一维，只有该维变成 100，其余为中间值 50', () => {
    const iItems = RIASEC_ITEMS.filter((item) => item.dimension === 'I').map((item) => item.id);
    const overrides: Record<string, number> = {};
    for (const id of iItems) overrides[id] = 5;
    const profile = scoreRiasec(answersWith(3, overrides));
    expect(profile.scores.I).toBe(100);
    expect(profile.scores.R).toBe(50);
    expect(profile.top[0]).toBe('I');
  });

  it('缺答时报错并说明还差几题', () => {
    const answers = answersWith(3);
    delete answers['r1'];
    delete answers['s4'];
    expect(() => scoreRiasec(answers)).toThrow(/还有 2 题没答/);
  });

  it('答案超出 1–5 时报错', () => {
    expect(() => scoreRiasec(answersWith(3, { r1: 9 }))).toThrow(/必须是 1–5 的整数/);
    expect(() => scoreRiasec(answersWith(3, { r1: 2.5 }))).toThrow(/必须是 1–5 的整数/);
  });

  it('前三码按分数从高到低排', () => {
    const overrides: Record<string, number> = {};
    for (const item of RIASEC_ITEMS.filter((entry) => entry.dimension === 'C')) overrides[item.id] = 5;
    for (const item of RIASEC_ITEMS.filter((entry) => entry.dimension === 'S')) overrides[item.id] = 4;
    const profile = scoreRiasec(answersWith(2, overrides));
    expect(profile.top.slice(0, 2)).toEqual(['C', 'S']);
  });
});

describe('岗位匹配', () => {
  const profile = scoreRiasec(answersWith(3, { ...Object.fromEntries(RIASEC_ITEMS.filter((i) => i.dimension === 'I').map((i) => [i.id, 5])), ...Object.fromEntries(RIASEC_ITEMS.filter((i) => i.dimension === 'C').map((i) => [i.id, 5])) }));

  it('研究型+常规型高的画像，排前面的是数据/分析类岗位', () => {
    const matches = matchOccupations(profile, OCCUPATIONS, { limit: 3 });
    expect(matches).toHaveLength(3);
    expect(matches[0]!.score).toBeGreaterThanOrEqual(matches[1]!.score);
    const ids = matches.map((match) => match.occupation.id);
    expect(ids.some((id) => ['bioinfo-engineer', 'biostatistician', 'genomic-analyst', 'health-data-analyst'].includes(id))).toBe(true);
  });

  it('每条匹配都给出可解释的理由', () => {
    const [first] = matchOccupations(profile, OCCUPATIONS, { limit: 1 });
    expect(first!.reasons.length).toBeGreaterThan(0);
    expect(first!.score).toBeGreaterThanOrEqual(0);
    expect(first!.score).toBeLessThanOrEqual(100);
  });

  it('兴趣明显不匹配时给出提醒', () => {
    const socialProfile = scoreRiasec(
      answersWith(3, {
        ...Object.fromEntries(RIASEC_ITEMS.filter((i) => i.dimension === 'R').map((i) => [i.id, 1])),
        ...Object.fromEntries(RIASEC_ITEMS.filter((i) => i.dimension === 'I').map((i) => [i.id, 1])),
      }),
    );
    const match = matchOccupations(socialProfile, OCCUPATIONS, { limit: 12 }).find(
      (entry) => entry.occupation.id === 'bioinfo-engineer',
    );
    expect(match!.cautions.length).toBeGreaterThan(0);
  });

  it('画像描述包含前三码', () => {
    expect(describeProfile(profile)).toContain(profile.top.slice(0, 3).join(''));
  });
});