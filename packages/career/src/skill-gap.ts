/**
 * 技能差距分析。
 *
 * 原则：只认**可验证的证据**。写过「熟悉 Python」不算，做出过一个别人能跑的项目才算。
 * 所以这里把「证据等级」和「岗位要求等级」分开，差距 = 要求 − 现有。
 */
import type { OccupationProfile, SkillEvidence, SkillGap } from './types.js';

export interface GapOptions {
  /** 最多返回多少条差距，默认 5。 */
  maxGaps?: number;
}

export interface GapReport {
  gaps: SkillGap[];
  /** 已经达到要求、且有证据的技能。 */
  strengths: string[];
  /** 达到要求但没写证据的技能 —— 面试一问就露馅，需要补材料。 */
  unverified: string[];
}

const LEVEL_NAMES: Record<number, string> = {
  0: '没接触过',
  1: '学过课程',
  2: '做过项目',
  3: '能独立负责并讲清楚',
};

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function suggestionFor(skill: string, required: number, current: number): string {
  if (current === 0) {
    return `先系统学一遍 ${skill}，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。`;
  }
  if (current === 1) {
    return `把 ${skill} 用在一个真实问题上：小项目也算，但要有输入、方法、结果和复盘。`;
  }
  return `在真实项目里独立负责一次 ${skill}，并留下可复现的记录（代码 + 决策原因），达到「${LEVEL_NAMES[required] ?? '更高'}」水平。`;
}

/** 对比岗位要求与现有技能证据，给出差距清单。 */
export function findSkillGaps(
  occupation: OccupationProfile,
  evidence: SkillEvidence[],
  options: GapOptions = {},
): GapReport {
  const bySkill = new Map<string, SkillEvidence>();
  for (const item of evidence) {
    bySkill.set(normalizeSkill(item.skill), item);
  }

  const gaps: SkillGap[] = [];
  const strengths: string[] = [];
  const unverified: string[] = [];

  for (const requirement of occupation.skills) {
    const current = bySkill.get(normalizeSkill(requirement.skill));
    const currentLevel = current?.level ?? 0;
    const delta = requirement.level - currentLevel;
    if (delta > 0) {
      gaps.push({
        skill: requirement.skill,
        required: requirement.level,
        current: currentLevel,
        delta,
        suggestion: suggestionFor(requirement.skill, requirement.level, currentLevel),
      });
      continue;
    }
    if (current?.evidence !== undefined && current.evidence.trim() !== '') {
      strengths.push(requirement.skill);
    } else {
      unverified.push(requirement.skill);
    }
  }

  gaps.sort((a, b) => b.delta - a.delta || a.skill.localeCompare(b.skill));
  const maxGaps = options.maxGaps ?? 5;
  return { gaps: gaps.slice(0, maxGaps), strengths, unverified };
}

/** 生成一段人类可读的差距总结，直接放进报告。 */
export function summarizeGaps(report: GapReport): string {
  const lines: string[] = [];
  if (report.gaps.length === 0) {
    lines.push('技能要求上没有明显缺口；接下来靠项目和实习把证据做扎实。');
  } else {
    lines.push(`最需要补的 ${report.gaps.length} 项：`);
    for (const gap of report.gaps) {
      lines.push(
        `- ${gap.skill}：岗位要求 ${LEVEL_NAMES[gap.required] ?? gap.required}，你目前 ${LEVEL_NAMES[gap.current] ?? gap.current}。${gap.suggestion}`,
      );
    }
  }
  if (report.strengths.length > 0) lines.push(`已有证据的强项：${report.strengths.join('、')}。`);
  if (report.unverified.length > 0) {
    lines.push(`达到要求但缺少证据：${report.unverified.join('、')}（面试会被追问，尽快补作品或记录）。`);
  }
  return lines.join('\n');
}