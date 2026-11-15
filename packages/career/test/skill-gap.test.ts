import { describe, expect, it } from 'vitest';
import { findOccupation } from '../src/data/occupations.js';
import { findSkillGaps, summarizeGaps } from '../src/skill-gap.js';
import type { SkillEvidence } from '../src/types.js';

const occupation = findOccupation('bioinfo-engineer')!;

describe('技能差距', () => {
  it('达到要求且有证据的技能进强项', () => {
    const evidence: SkillEvidence[] = [{ skill: 'Python 编程', level: 3, evidence: '课程项目 + 仓库链接' }];
    const report = findSkillGaps(occupation, evidence);
    expect(report.strengths).toContain('Python 编程');
  });

  it('达到要求但没写证据的技能进「待补证据」', () => {
    const evidence: SkillEvidence[] = [{ skill: 'Python 编程', level: 3 }];
    const report = findSkillGaps(occupation, evidence);
    expect(report.unverified).toContain('Python 编程');
    expect(report.strengths).not.toContain('Python 编程');
  });

  it('技能名大小写/空格不同也能对上', () => {
    const evidence: SkillEvidence[] = [{ skill: '  python   编程 ', level: 3, evidence: 'x' }];
    const report = findSkillGaps(occupation, evidence);
    expect(report.strengths).toContain('Python 编程');
  });

  it('差距按 delta 从大到小排，并给出可执行的建议', () => {
    const evidence: SkillEvidence[] = [{ skill: 'Linux 命令行与服务器操作', level: 2, evidence: '服务器上跑过流程' }];
    const report = findSkillGaps(occupation, evidence, { maxGaps: 20 });
    const linux = report.gaps.find((gap) => gap.skill === 'Linux 命令行与服务器操作');
    expect(linux).toMatchObject({ current: 2, required: 3, delta: 1 });
    for (let index = 1; index < report.gaps.length; index += 1) {
      expect(report.gaps[index - 1]!.delta).toBeGreaterThanOrEqual(report.gaps[index]!.delta);
    }
    expect(linux!.suggestion).toContain('Linux 命令行与服务器操作');
  });

  it('完全没填证据时，所有要求都是差距（受 maxGaps 限制）', () => {
    const report = findSkillGaps(occupation, [], { maxGaps: 3 });
    expect(report.gaps).toHaveLength(3);
    expect(report.gaps[0]!.current).toBe(0);
  });

  it('总结文本既说差距也提醒缺证据', () => {
    const report = findSkillGaps(occupation, [{ skill: 'Python 编程', level: 3 }]);
    const text = summarizeGaps(report);
    expect(text).toContain('最需要补');
    expect(text).toContain('缺少证据');
  });

  it('没有差距时给出正向结论而不是空字符串', () => {
    const allSkills = occupation.skills.map((skill) => ({ skill: skill.skill, level: 3 as const, evidence: 'e' }));
    const report = findSkillGaps(occupation, allSkills);
    expect(report.gaps).toHaveLength(0);
    expect(summarizeGaps(report)).toContain('没有明显缺口');
  });
});