import { describe, expect, it } from 'vitest';
import { findOccupation } from '../src/data/occupations.js';
import { buildFourYearPlan } from '../src/plan.js';

const bioinfo = findOccupation('bioinfo-engineer')!;
const biostat = findOccupation('biostatistician')!;

function textOf(plan: ReturnType<typeof buildFourYearPlan>): string {
  return JSON.stringify(plan);
}

describe('四年计划', () => {
  it('生成 4 个学年，年份从入学年递增', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: '医疗健康大数据', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(plan.years).toHaveLength(4);
    expect(plan.years[0]!.label).toContain('大一');
    expect(plan.years[0]!.year).toBe(2026);
    expect(plan.years[3]!.year).toBe(2029);
    expect(plan.years[0]!.label).toContain('2026–2027');
  });

  it('每一年都有技能时间线、优势、短板、目标和交付物', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: '医疗健康大数据', startYear: 2026 },
      occupation: bioinfo,
    });
    for (const year of plan.years) {
      expect(year.skillTimeline.length).toBeGreaterThanOrEqual(2);
      expect(year.skillTimeline.every((entry) => entry.items.length > 0)).toBe(true);
      expect(year.objectives.length).toBeGreaterThanOrEqual(2);
      expect(year.deliverables.length).toBeGreaterThan(0);
      expect(year.strengths.length).toBeGreaterThan(0);
      expect(year.weaknesses.length).toBeGreaterThan(0);
    }
  });

  it('考研路线在大三下进入系统备考', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: '医疗健康大数据', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(textOf(plan)).toContain('系统备考');
  });

  it('保研路线准备夏令营，就业路线准备秋招', () => {
    const baoyan = buildFourYearPlan({
      goal: { degree: '保研', direction: '生物信息', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(textOf(baoyan)).toContain('夏令营');

    const job = buildFourYearPlan({
      goal: { degree: '本科就业', direction: '健康数据', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(textOf(job)).toContain('秋招');
  });

  it('出国路线在大二下开始了解目标院校', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '出国', direction: '生物统计', startYear: 2026 },
      occupation: biostat,
    });
    expect(textOf(plan)).toContain('目标院校');
  });

  it('没填技能证据时给出明确 warning，而不是假装有数据', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: 'x', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(plan.warnings.join('\n')).toContain('没有填写技能证据');
  });

  it('本科就业 + 硕士起步岗位时提示匹配度偏低', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '本科就业', direction: '生物统计', startYear: 2026 },
      occupation: biostat,
      currentSkills: [{ skill: 'SAS 编程', level: 2, evidence: '课程作业' }],
    });
    expect(plan.warnings.join('\n')).toContain('硕士及以上');
    expect(plan.warnings.join('\n')).not.toContain('没有填写技能证据');
  });

  it('技能证据进入第一年的强项/短板，而不是写空话', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: 'x', startYear: 2026 },
      occupation: bioinfo,
      currentSkills: [{ skill: 'Python 编程', level: 3, evidence: '项目' }],
    });
    expect(plan.years[0]!.strengths.join('\n')).toContain('Python 编程');
  });

  it('总有两个备选方案防止一条路走死', () => {
    const plan = buildFourYearPlan({
      goal: { degree: '考研', direction: 'x', startYear: 2026 },
      occupation: bioinfo,
    });
    expect(plan.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(plan.alternatives.every((alternative) => alternative.actions.length > 0)).toBe(true);
  });

  it('年数越界时报错', () => {
    expect(() =>
      buildFourYearPlan({ goal: { degree: '考研', direction: 'x', startYear: 2026 }, occupation: bioinfo, years: 0 }),
    ).toThrow(/年数必须在 1–5/);
  });
});