/** 霍兰德六维（RIASEC）。 */
export type RiasecDimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export const RIASEC_DIMENSIONS: readonly RiasecDimension[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export const RIASEC_NAMES: Record<RiasecDimension, string> = {
  R: '实用型（动手/工具/设备）',
  I: '研究型（分析/推理/实验）',
  A: '艺术型（表达/创意/审美）',
  S: '社会型（助人/教学/协作）',
  E: '企业型（组织/说服/推动）',
  C: '常规型（数据/流程/规范）',
};

/** 0–100 的标准化得分。 */
export type RiasecScores = Record<RiasecDimension, number>;

export interface RiasecProfile {
  scores: RiasecScores;
  /** 由高到低排好的前三码，例如 ['I','C','R']。 */
  top: RiasecDimension[];
}

export interface RiasecItem {
  id: string;
  dimension: RiasecDimension;
  text: string;
}

/** 用户回答：itemId → 1（完全不像我）…5（非常像我）。 */
export type RiasecAnswers = Record<string, number>;

export type SkillLevel = 1 | 2 | 3;

export interface SkillRequirement {
  skill: string;
  /** 1=知道概念、2=能独立用、3=能带别人做/能解决开放问题。 */
  level: SkillLevel;
  note?: string;
}

export type CareerField =
  | 'bioinformatics'
  | 'health-data'
  | 'clinical-research'
  | 'pharma'
  | 'academic'
  | 'product'
  | 'communication';

/**
 * 一个岗位画像。
 *
 * 数据来源说明：RIASEC 权重与任务描述参考 O*NET 的公开职业条目（CC BY 4.0）
 * 以及国内招聘 JD 的常见要求，由作者**改写为中文表述**，不是 O*NET 数据的副本；
 * 因此本仓库不声称与 O*NET 数值一致，也不分发其原始数据。
 */
export interface OccupationProfile {
  id: string;
  title: string;
  field: CareerField;
  /** 0–7 的兴趣强度，缺省视为 0。 */
  riasec: Partial<Record<RiasecDimension, number>>;
  skills: SkillRequirement[];
  tasks: string[];
  /** 学历门槛与常见考研方向。 */
  education: string[];
  /** 从校园进入这个岗位的常见路径。 */
  entry: string[];
  /** 一句话说明「这岗位一天到晚在干什么」。 */
  oneLiner: string;
  sources: string;
}

export interface OccupationMatch {
  occupation: OccupationProfile;
  /** 0–100，越大越契合。 */
  score: number;
  /** 为什么推荐（中文，可解释）。 */
  reasons: string[];
  /** 需要注意的落差。 */
  cautions: string[];
}

export interface CareerGoal {
  /** 本科毕业后第一步。 */
  degree: '本科就业' | '考研' | '保研' | '出国';
  /** 目标方向的一句话描述，例如「医疗健康大数据」。 */
  direction: string;
  occupationId?: string;
  /** 入学年份，用于把计划映射到具体学年。 */
  startYear: number;
}

export interface SkillEvidence {
  skill: string;
  /** 0=没接触过、1=学过课程、2=做过项目、3=能独立负责并讲清楚。 */
  level: 0 | 1 | 2 | 3;
  /** 证据：课程名/项目名/作品链接，写清楚才算数。 */
  evidence?: string;
}

export interface SkillGap {
  skill: string;
  required: SkillLevel;
  current: number;
  /** required - current，>0 表示还差。 */
  delta: number;
  suggestion: string;
}

export interface TimelineEntry {
  /** 学期或时间段，例如「大一上」「大二暑假」。 */
  period: string;
  items: string[];
}

export interface YearPlan {
  year: number;
  /** 例如「大一（2026–2027）」。 */
  label: string;
  skillTimeline: TimelineEntry[];
  strengths: string[];
  weaknesses: string[];
  objectives: string[];
  /** 可交付、可验收的产出（写进简历/作品集的东西）。 */
  deliverables: string[];
}

export interface PlanAlternative {
  name: string;
  /** 什么情况下启用。 */
  trigger: string;
  actions: string[];
}

export interface CareerPlan {
  goal: CareerGoal;
  occupation: OccupationProfile;
  years: YearPlan[];
  alternatives: PlanAlternative[];
  /** 计划生成时发现的信息缺口（例如没填技能证据）。 */
  warnings: string[];
}

export interface ParsedJd {
  title: string | null;
  education: string | null;
  experience: string | null;
  responsibilities: string[];
  requirements: string[];
  skills: Array<{ skill: string; priority: 'required' | 'preferred' }>;
  keywords: string[];
}