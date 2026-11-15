/**
 * RIASEC 兴趣测评与岗位匹配。
 *
 * 只用霍兰德六维：它是公共领域的职业兴趣框架，量表条目是作者自编的行为描述，
 * 不复制任何受版权保护的测评问卷，也不使用带注册商标的心理量表名称。
 */
import { OCCUPATIONS } from './data/occupations.js';
import {
  RIASEC_DIMENSIONS,
  RIASEC_NAMES,
  type OccupationMatch,
  type OccupationProfile,
  type RiasecAnswers,
  type RiasecDimension,
  type RiasecItem,
  type RiasecProfile,
  type RiasecScores,
} from './types.js';

/** 24 条行为描述，每维 4 条。回答用 1–5 分（1=完全不像我，5=非常像我）。 */
export const RIASEC_ITEMS: RiasecItem[] = [
  { id: 'r1', dimension: 'R', text: '拆装、修理电子设备或仪器时，我会很投入。' },
  { id: 'r2', dimension: 'R', text: '我愿意花时间在实验台前把一套装置调到能用。' },
  { id: 'r3', dimension: 'R', text: '比起在纸上推演，我更想先动手试一遍。' },
  { id: 'r4', dimension: 'R', text: '我喜欢和具体的工具、设备、材料打交道。' },

  { id: 'i1', dimension: 'I', text: '听到一个结论，我会追问「证据是什么、为什么」。' },
  { id: 'i2', dimension: 'I', text: '为了搞清一个机制，我愿意去读原始研究论文。' },
  { id: 'i3', dimension: 'I', text: '我喜欢从数据里找规律，再提出假设去验证。' },
  { id: 'i4', dimension: 'I', text: '面对复杂问题，我愿意把它拆成一个个小问题。' },

  { id: 'a1', dimension: 'A', text: '我喜欢把复杂的东西讲得清楚、好看。' },
  { id: 'a2', dimension: 'A', text: '做图、排版、剪辑这类事会让我有创作欲。' },
  { id: 'a3', dimension: 'A', text: '我习惯用比喻或故事来解释一个概念。' },
  { id: 'a4', dimension: 'A', text: '我愿意尝试非常规的做法，而不是照流程走。' },

  { id: 's1', dimension: 'S', text: '同学来问问题，我愿意停下来帮他讲明白。' },
  { id: 's2', dimension: 'S', text: '在团队里我常做协调、倾听、安抚的角色。' },
  { id: 's3', dimension: 'S', text: '看到别人因为我的帮助而进步，我很有成就感。' },
  { id: 's4', dimension: 'S', text: '我愿意做志愿服务、科普或带新人。' },

  { id: 'e1', dimension: 'E', text: '我喜欢牵头组织活动，把大家拉起来干一件事。' },
  { id: 'e2', dimension: 'E', text: '我愿意说服别人接受我的方案。' },
  { id: 'e3', dimension: 'E', text: '「把事情做成」比「把原理彻底搞清」更让我兴奋。' },
  { id: 'e4', dimension: 'E', text: '我喜欢谈资源、谈合作、谈条件。' },

  { id: 'c1', dimension: 'C', text: '我喜欢把数据、文件、笔记整理得井井有条。' },
  { id: 'c2', dimension: 'C', text: '我愿意照规范写文档、填表、走流程。' },
  { id: 'c3', dimension: 'C', text: '我会核对数字和细节，受不了前后不一致。' },
  { id: 'c4', dimension: 'C', text: '我喜欢把重复的事做成清单、模板或自动化脚本。' },
];

const ITEMS_PER_DIMENSION = 4;
const MIN_ANSWER = 1;
const MAX_ANSWER = 5;

/**
 * 计算六维得分（0–100）与前三码。
 *
 * 要求 24 条全部作答；缺答会抛错并列出缺哪些 —— 少答几条就下结论是测评最常见的错。
 */
export function scoreRiasec(answers: RiasecAnswers): RiasecProfile {
  const missing = RIASEC_ITEMS.filter((item) => answers[item.id] === undefined).map((item) => item.id);
  if (missing.length > 0) {
    throw new Error(`还有 ${missing.length} 题没答：${missing.join(', ')}`);
  }
  const sums: RiasecScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const item of RIASEC_ITEMS) {
    const value = answers[item.id]!;
    if (!Number.isInteger(value) || value < MIN_ANSWER || value > MAX_ANSWER) {
      throw new Error(`第 ${item.id} 题的答案必须是 ${MIN_ANSWER}–${MAX_ANSWER} 的整数，收到 ${String(value)}`);
    }
    sums[item.dimension] += value;
  }
  const scores = {} as RiasecScores;
  for (const dimension of RIASEC_DIMENSIONS) {
    const raw = sums[dimension];
    const min = ITEMS_PER_DIMENSION * MIN_ANSWER;
    const max = ITEMS_PER_DIMENSION * MAX_ANSWER;
    scores[dimension] = Math.round(((raw - min) / (max - min)) * 100);
  }
  const top = [...RIASEC_DIMENSIONS].sort((a, b) => scores[b] - scores[a]);
  return { scores, top };
}

/** 把岗位的 0–7 权重映射成 0–100 的目标画像。 */
function targetScores(occupation: OccupationProfile): RiasecScores {
  const scores = {} as RiasecScores;
  for (const dimension of RIASEC_DIMENSIONS) {
    scores[dimension] = Math.round(((occupation.riasec[dimension] ?? 0) / 7) * 100);
  }
  return scores;
}

export interface MatchOptions {
  limit?: number;
}

/**
 * 按兴趣画像给岗位排序。
 *
 * 打分 = 100 − 六维平均绝对差 + 前三码重合加分（每重合一维 +3，上限 9）。
 * 这不是心理测量学意义上的"匹配度"，只是把「哪些岗位更吃你这套兴趣」排个序。
 */
export function matchOccupations(
  profile: RiasecProfile,
  occupations: OccupationProfile[] = OCCUPATIONS,
  options: MatchOptions = {},
): OccupationMatch[] {
  const limit = options.limit ?? 5;
  const matches = occupations.map((occupation) => {
    const target = targetScores(occupation);
    let totalDiff = 0;
    for (const dimension of RIASEC_DIMENSIONS) {
      totalDiff += Math.abs(profile.scores[dimension] - target[dimension]);
    }
    const base = 100 - totalDiff / RIASEC_DIMENSIONS.length;
    const occupationTop = [...RIASEC_DIMENSIONS]
      .sort((a, b) => (occupation.riasec[b] ?? 0) - (occupation.riasec[a] ?? 0))
      .slice(0, 3);
    const overlap = profile.top.slice(0, 3).filter((dimension) => occupationTop.includes(dimension));
    const score = Math.max(0, Math.min(100, Math.round(base + overlap.length * 3)));

    const reasons: string[] = [];
    const cautions: string[] = [];
    for (const dimension of overlap) {
      reasons.push(
        `你的${RIASEC_NAMES[dimension]}得分 ${profile.scores[dimension]}，这个岗位也吃这一维。`,
      );
    }
    for (const dimension of occupationTop) {
      const gap = target[dimension] - profile.scores[dimension];
      if (gap >= 30) {
        cautions.push(
          `这个岗位更依赖${RIASEC_NAMES[dimension]}（岗位需要 ${target[dimension]}，你 ${profile.scores[dimension]}），入职后要靠刻意练习补。`,
        );
      }
    }
    if (reasons.length === 0) reasons.push('兴趣维度上没有明显重合，可能要靠技能和机会去补。');
    return { occupation, score, reasons, cautions };
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/** 生成一句话画像，用于报告开头。 */
export function describeProfile(profile: RiasecProfile): string {
  const [first, second, third] = profile.top;
  const names = [first, second, third]
    .filter((dimension): dimension is RiasecDimension => dimension !== undefined)
    .map((dimension) => `${dimension}（${RIASEC_NAMES[dimension]}）`);
  return `兴趣前三码：${profile.top.slice(0, 3).join('')} —— ${names.join('、')}`;
}