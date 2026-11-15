/**
 * @dsh-learning/career
 *
 * 职业规划：兴趣画像 → 岗位画像 → 技能差距 → 四年计划。
 *
 * 刻意不做的三件事：
 * - 不复制第三方职业规划项目（Career-Planning 等仓库）的代码与岗位数据；
 * - 不使用带注册商标的心理测评名称，只用公共领域的霍兰德 RIASEC 框架 + 自编行为条目；
 * - 不做实时岗位爬取（v1）：改为「内置岗位画像 + 用户粘贴 JD 解析」。
 */
export * from './types.js';
export { OCCUPATIONS, findOccupation } from './data/occupations.js';
export {
  RIASEC_ITEMS,
  scoreRiasec,
  matchOccupations,
  describeProfile,
  type MatchOptions,
} from './riasec.js';
export { parseJobDescription, SKILL_LEXICON } from './jd-parse.js';
export { findSkillGaps, summarizeGaps, type GapOptions, type GapReport } from './skill-gap.js';
export { buildFourYearPlan, type PlanOptions } from './plan.js';