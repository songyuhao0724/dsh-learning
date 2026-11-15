import {
  OCCUPATIONS,
  RIASEC_ITEMS,
  RIASEC_NAMES,
  buildFourYearPlan,
  describeProfile,
  findOccupation,
  findSkillGaps,
  matchOccupations,
  parseJobDescription,
  scoreRiasec,
  summarizeGaps,
} from '@dsh-learning/career';
import type { RiasecProfile, RiasecScores, SkillEvidence } from '@dsh-learning/career';
import { readArray, readNumber, readString, requireString, text } from '../args.js';
import type { PluginContext, ToolsConfig } from '../types.js';

const OBJECT = { type: 'object' } as const;
const DIMENSIONS = ['R', 'I', 'A', 'S', 'E', 'C'] as const;

const DEGREES = ['本科就业', '考研', '保研', '出国'] as const;

/** 职业规划工具：兴趣画像 → 岗位匹配 → JD 解析 → 技能差距 → 四年计划。 */
export function registerCareerTools(ctx: PluginContext, _config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_career_occupations',
    description: '列出内置的 12 个生物信息 / 医学信息方向岗位画像（一天在做什么、学历门槛、核心技能），可按关键词筛。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { query: { type: 'string', description: '关键词，比如「数据」「统计」「基因」。' } },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as { count: number; occupations: Array<{ title: string; education: string; oneLiner: string; skills: string[] }> };
        if (result.count === 0) return text('没有匹配的岗位画像，换个关键词。');
        return text(
          `内置 ${result.count} 个岗位画像：`,
          '',
          ...result.occupations.map(
            (occupation, index) =>
              `${index + 1}. ${occupation.title}（${occupation.education}）\n   ${occupation.oneLiner}\n   核心技能：${occupation.skills.join('、')}`,
          ),
        );
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const query = readString(args, 'query')?.toLowerCase();
      const matched = OCCUPATIONS.filter((occupation) => {
        if (query === undefined) return true;
        const haystack = `${occupation.title} ${occupation.field} ${occupation.oneLiner}`.toLowerCase();
        return haystack.includes(query);
      });
      return {
        count: matched.length,
        occupations: matched.map((occupation) => ({
          id: occupation.id,
          title: occupation.title,
          field: occupation.field,
          education: occupation.education,
          oneLiner: occupation.oneLiner,
          skills: occupation.skills.map((skill) => `${skill.skill}(${skill.level})`),
        })),
      };
    },
  });

  ctx.tools.register({
    name: 'study_career_match',
    description:
      '按霍兰德 RIASEC 兴趣画像匹配岗位。可以给 24 道题的作答（1–5 的数组，顺序与 study_career_riasec 题目一致），或直接给六维分数（0–100）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        answers: { type: 'array', items: { type: 'integer' }, description: '24 道题的作答，1（完全不像我）到 5（非常像我），按题目顺序。' },
        scores: {
          type: 'object',
          additionalProperties: false,
          properties: {
            R: { type: 'number', description: '现实型：动手、设备、户外' },
            I: { type: 'number', description: '研究型：分析、推理、求知' },
            A: { type: 'number', description: '艺术型：表达、创意、审美' },
            S: { type: 'number', description: '社会型：帮人、教学、协作' },
            E: { type: 'number', description: '企业型：说服、组织、主导' },
            C: { type: 'number', description: '常规型：条理、数据、流程' },
          },
        },
        limit: { type: 'integer', description: '返回多少个匹配岗位，默认 5。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          profile: { scores: Record<string, number>; top: string[] };
          summary: string;
          matches: Array<{ title: string; score: number; reasons: string[]; cautions: string[] }>;
        };
        if (result.matches.length === 0) return text(result.summary, '没有匹配到岗位。');
        const blocks = result.matches.map((match, index) => {
          const lines = [`${index + 1}. ${match.title}（匹配度 ${match.score.toFixed(1)}）`];
          if (match.reasons.length > 0) lines.push(`   为什么：${match.reasons.join('；')}`);
          if (match.cautions.length > 0) lines.push(`   要留神：${match.cautions.join('；')}`);
          return lines.join('\n');
        });
        return text(result.summary, '', ...blocks);
      },
    },
    async execute(args) {
      const answers = readArray(args, 'answers');
      const scores = readScores(args);
      let profile: RiasecProfile;
      if (answers !== undefined && answers.length > 0) {
        if (answers.length !== RIASEC_ITEMS.length) {
          throw new Error(`answers 要有 ${RIASEC_ITEMS.length} 个作答，收到 ${answers.length} 个。`);
        }
        const mapped: Record<string, number> = {};
        RIASEC_ITEMS.forEach((item, index) => {
          const value = answers[index];
          if (typeof value !== 'number') throw new Error(`第 ${index + 1} 题不是数字。`);
          mapped[item.id] = value;
        });
        profile = scoreRiasec(mapped);
      } else if (scores !== undefined) {
        profile = { scores, top: [...DIMENSIONS].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0)).slice(0, 3) };
      } else {
        throw new Error('给 answers（24 个作答）或 scores（六维分数）之一。');
      }
      const matches = matchOccupations(profile, OCCUPATIONS, { limit: readNumber(args, 'limit') ?? 5 });
      const summary = describeProfile(profile);
      return {
        profile: { scores: profile.scores, top: profile.top },
        summary,
        matches: matches.map((match) => ({
          id: match.occupation.id,
          title: match.occupation.title,
          score: match.score,
          reasons: match.reasons,
          cautions: match.cautions,
        })),
      };
    },
  });

  ctx.tools.register({
    name: 'study_career_jd',
    description: '把一段招聘 JD 原文拆成结构化要求：学历、年限、岗位职责、硬性要求、加分项、技能清单。用于判断「这个岗位到底要什么」，不需要联网。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { text: { type: 'string', description: '招聘 JD 的原文（从招聘网站复制即可）。' } },
      required: ['text'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const jd = value as {
          title: string | null;
          education: string | null;
          experience: string | null;
          responsibilities: string[];
          requirements: string[];
          skills: Array<{ skill: string; priority: string }>;
        };
        const must = jd.skills.filter((item) => item.priority === 'required').map((item) => item.skill);
        const nice = jd.skills.filter((item) => item.priority === 'preferred').map((item) => item.skill);
        return text(
          `岗位：${jd.title ?? '(未识别)'}｜学历：${jd.education ?? '未写'}｜经验：${jd.experience ?? '未写'}`,
          must.length === 0 ? undefined : `硬性技能：${must.join('、')}`,
          nice.length === 0 ? undefined : `加分技能：${nice.join('、')}`,
          jd.responsibilities.length === 0 ? undefined : `职责 ${jd.responsibilities.length} 条`,
          jd.requirements.length === 0 ? undefined : `要求 ${jd.requirements.length} 条`,
          jd.skills.length === 0 ? '没识别出技能词：这份 JD 可能写得比较模糊，或需要补充词表。' : undefined,
        );
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const input = requireString(args, 'text', '粘贴 JD 原文');
      const jd = parseJobDescription(input);
      return {
        title: jd.title,
        education: jd.education,
        experience: jd.experience,
        responsibilities: jd.responsibilities,
        requirements: jd.requirements,
        skills: jd.skills,
        keywords: jd.keywords,
      };
    },
  });

  ctx.tools.register({
    name: 'study_career_gap',
    description: '对照某个岗位画像算技能差距：只承认带证据的技能，输出「最该补的 3 项」和「达到要求但缺证据」的清单。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        occupationId: { type: 'string', description: '岗位 id，可用 study_career_occupations 查。' },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              skill: { type: 'string', description: '技能名，例如 Python 编程' },
              level: { type: 'integer', description: '0=没接触过，1=学过课程，2=能独立做，3=能负责并讲清取舍' },
              evidence: { type: 'string', description: '证据：课程项目、仓库、报告、实习等；写不出证据就说明还没到这一级' },
            },
            required: ['skill', 'level'],
          },
          description: '你现在的技能与证据清单。',
        },
      },
      required: ['occupationId'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const report = value as {
          occupation: string;
          summary: string;
          gaps: Array<{ skill: string; required: number; current: number; suggestion: string }>;
          strengths: string[];
          unverified: string[];
        };
        return text(
          report.summary,
          report.gaps.length === 0 ? undefined : '',
          ...report.gaps.map((gap) => `· 补「${gap.skill}」：现在 ${gap.current} 级 / 要求 ${gap.required} 级 —— ${gap.suggestion}`),
          report.strengths.length === 0 ? undefined : `已达成：${report.strengths.join('、')}`,
          report.unverified.length === 0 ? undefined : `达到要求但没写证据：${report.unverified.join('、')}`,
        );
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const occupationId = requireString(args, 'occupationId', '例如 bioinfo-engineer');
      const occupation = findOccupation(occupationId);
      if (occupation === undefined) {
        throw new Error(`没有 id 为 ${occupationId} 的岗位画像，可用：${OCCUPATIONS.map((item) => item.id).join('、')}`);
      }
      const skills = toSkillEvidence(readArray(args, 'skills'));
      const report = findSkillGaps(occupation, skills);
      return {
        occupation: occupation.title,
        summary: summarizeGaps(report),
        gaps: report.gaps,
        strengths: report.strengths,
        unverified: report.unverified,
      };
    },
  });

  ctx.tools.register({
    name: 'study_career_plan',
    description:
      '生成大学四年（或五年）发展计划：按毕业去向分叉，每年给出技能时间线、优势、短板、目标和可交付物，另附备选方案。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        degree: { type: 'string', enum: [...DEGREES], description: '毕业去向。' },
        direction: { type: 'string', description: '想走的方向，例如「医疗健康大数据」。' },
        occupationId: { type: 'string', description: '目标岗位 id；不给则按方向猜一个最接近的。' },
        startYear: { type: 'integer', description: '入学年份，例如 2026。' },
        years: { type: 'integer', description: '学制年数，默认 4。' },
        skills: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              skill: { type: 'string' },
              level: { type: 'integer' },
              evidence: { type: 'string' },
            },
            required: ['skill', 'level'],
          },
          description: '当前技能与证据；不传则计划里的短板只能按岗位要求推断。',
        },
      },
      required: ['degree', 'direction'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const plan = value as {
          occupation: { title: string };
          years: Array<{ label: string; skillTimeline: Array<{ period: string; items: string[] }>; strengths: string[]; weaknesses: string[]; objectives: string[]; deliverables: string[] }>;
          alternatives: Array<{ name: string; trigger: string; actions: string[] }>;
          warnings: string[];
        };
        const blocks: string[] = [`目标岗位：${plan.occupation.title}`];
        for (const year of plan.years) {
          blocks.push('', `## ${year.label}`);
          for (const entry of year.skillTimeline) blocks.push(`· ${entry.period}：${entry.items.join('；')}`);
          if (year.objectives.length > 0) blocks.push(`目标：${year.objectives.join('；')}`);
          if (year.deliverables.length > 0) blocks.push(`交付物：${year.deliverables.join('；')}`);
          if (year.strengths.length > 0) blocks.push(`优势：${year.strengths.join('、')}`);
          if (year.weaknesses.length > 0) blocks.push(`短板：${year.weaknesses.join('、')}`);
        }
        if (plan.alternatives.length > 0) {
          blocks.push('', '## 备选方案');
          for (const alternative of plan.alternatives) {
            blocks.push(`· ${alternative.name}（触发：${alternative.trigger}）`, `   ${alternative.actions.join('；')}`);
          }
        }
        if (plan.warnings.length > 0) blocks.push('', ...plan.warnings.map((warning) => `注意：${warning}`));
        return text(...blocks);
      },
    },
    async execute(args) {
      const degree = requireString(args, 'degree', '本科就业 / 考研 / 保研 / 出国') as (typeof DEGREES)[number];
      if (!(DEGREES as readonly string[]).includes(degree)) {
        throw new Error(`degree 只能是：${DEGREES.join(' / ')}`);
      }
      const direction = requireString(args, 'direction', '例如「医疗健康大数据」');
      const occupationId = readString(args, 'occupationId');
      const occupation = occupationId === undefined ? guessOccupation(direction) : findOccupation(occupationId);
      if (occupation === undefined) {
        throw new Error(
          occupationId === undefined
            ? `按方向「${direction}」没猜出岗位，请显式给 occupationId（可用：${OCCUPATIONS.map((item) => item.id).join('、')}）`
            : `没有 id 为 ${occupationId} 的岗位画像`,
        );
      }
      const plan = buildFourYearPlan({
        goal: {
          degree,
          direction,
          startYear: readNumber(args, 'startYear') ?? new Date().getFullYear(),
        },
        occupation,
        currentSkills: toSkillEvidence(readArray(args, 'skills')),
        years: readNumber(args, 'years') ?? 4,
      });
      return {
        goal: plan.goal,
        occupation: { id: plan.occupation.id, title: plan.occupation.title },
        years: plan.years,
        alternatives: plan.alternatives,
        warnings: plan.warnings,
      };
    },
  });
}

function readScores(args: unknown): RiasecScores | undefined {
  const record = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)['scores'] : undefined;
  if (typeof record !== 'object' || record === null) return undefined;
  const source = record as Record<string, unknown>;
  const scores: RiasecScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  let any = false;
  for (const dimension of DIMENSIONS) {
    const value = source[dimension];
    if (typeof value === 'number' && Number.isFinite(value)) {
      scores[dimension] = value;
      any = true;
    }
  }
  return any ? scores : undefined;
}

function toSkillEvidence(items: unknown[] | undefined): SkillEvidence[] {
  if (items === undefined) return [];
  const result: SkillEvidence[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const skill = typeof record['skill'] === 'string' ? record['skill'].trim() : '';
    const level = record['level'];
    if (skill === '' || typeof level !== 'number') continue;
    const evidence = typeof record['evidence'] === 'string' && record['evidence'].trim() !== '' ? record['evidence'].trim() : undefined;
    result.push({ skill, level: Math.max(0, Math.min(3, Math.round(level))) as 0 | 1 | 2 | 3, ...(evidence === undefined ? {} : { evidence }) });
  }
  return result;
}

/** 按方向关键词猜一个岗位画像，猜不到就返回 undefined 让调用方报错。 */
function guessOccupation(direction: string) {
  const text = direction.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/统计|生统|生物统计|biostat/, 'biostatistician'],
    [/基因|基因组|组学|genom/, 'genomic-analyst'],
    [/临床数据|临床试验|crc|edc/, 'clinical-data-manager'],
    [/医学信息|医院信息|his|informatics/, 'medical-informatics-product'],
    [/药物|药企|pharma/, 'pharma-data-scientist'],
    [/精准医疗|precision/, 'precision-medicine-researcher'],
    [/影像|图像|ai|人工智能/, 'medical-ai-engineer'],
    [/健康数据|医疗健康数据|大数据/, 'health-data-analyst'],
    [/生物信息|生信|bioinfo/, 'bioinfo-engineer'],
  ];
  for (const [pattern, id] of rules) {
    if (pattern.test(text)) return findOccupation(id);
  }
  return undefined;
}

/** 六维中文名，供上层拼提示语时复用。 */
export const RIASEC_LABELS = RIASEC_NAMES;