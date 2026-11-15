/**
 * 四年计划生成。
 *
 * 这是「职业规划报告」里最容易被写成空话的部分，所以这里刻意做两件事：
 * 1. 每一年都给出**可交付物**（能放进作品集/简历的东西），而不是"提升综合素质"；
 * 2. 计划随毕业去向（考研/就业/出国）分叉 —— 大三开始的节奏完全不同。
 */
import { findSkillGaps } from './skill-gap.js';
import type {
  CareerGoal,
  CareerPlan,
  OccupationProfile,
  PlanAlternative,
  SkillEvidence,
  TimelineEntry,
  YearPlan,
} from './types.js';

export interface PlanOptions {
  goal: CareerGoal;
  occupation: OccupationProfile;
  currentSkills?: SkillEvidence[];
  /** 计划年数，默认 4（大五专业可传 5）。 */
  years?: number;
}

const YEAR_LABELS = ['大一', '大二', '大三', '大四', '大五'];

function skillNames(occupation: OccupationProfile, predicate: (level: number) => boolean, limit: number): string[] {
  return occupation.skills
    .filter((requirement) => predicate(requirement.level))
    .map((requirement) => requirement.skill)
    .slice(0, limit);
}

function yearTimeline(
  index: number,
  occupation: OccupationProfile,
  goal: CareerGoal,
): TimelineEntry[] {
  const basics = skillNames(occupation, (level) => level <= 2, 3);
  const core = skillNames(occupation, (level) => level >= 2, 3);
  const advanced = skillNames(occupation, (level) => level === 3, 2);
  const [firstBasic = '专业基础课', secondBasic = '一门编程语言', thirdBasic = '文献阅读'] = basics;
  const [firstCore = '核心分析工具', secondCore = '统计方法', thirdCore = '项目实践'] = core;
  const [firstAdvanced = '完整项目', secondAdvanced = '技术方案设计'] = advanced;

  if (index === 0) {
    return [
      {
        period: '大一上',
        items: [
          '把数学（高数/线代）与专业基础课学到能做题、能解释概念，别靠期末突击。',
          `开始练 ${firstBasic}，每周固定 3 次每次 1 小时，比周末突击有效。`,
          `读 5 篇 ${goal.direction} 方向的中文综述，画一张"这个领域在研究什么"的思维导图。`,
        ],
      },
      {
        period: '大一下',
        items: [
          `学到能用 ${secondBasic} 独立完成一次课程作业的程度。`,
          '加入一个实验室/学生项目/社团技术组，先做"打杂"也是进入现场。',
          '建立文献管理习惯（Zotero + 每周读 2 篇），避免大四临时补。',
        ],
      },
      {
        period: '大一暑假',
        items: [
          `用 ${secondBasic} 做一个小工具/小分析，跑通"输入→处理→输出→写清结论"全流程。`,
          '把结果写成一页说明（问题、方法、结果、局限），这是报告能力的起点。',
        ],
      },
    ];
  }

  if (index === 1) {
    return [
      {
        period: '大二上',
        items: [
          `系统学 ${firstCore}，跟着教程做完一遍后，脱开教程重做一遍。`,
          `把 ${thirdBasic} 变成习惯：每周至少精读 1 篇英文文献并写 200 字摘要。`,
          '争取进课题组做真实数据（哪怕是清洗数据），比做玩具数据集有价值。',
        ],
      },
      {
        period: '大二下',
        items: [
          `把 ${secondCore} 学到能做课程级分析：知道什么时候用什么方法、为什么。`,
          '准备英语考试（四六级/雅思托福按去向定），英语是后面所有机会的门槛。',
          goal.degree === '出国'
            ? '开始了解目标院校与项目要求，列出语言与 GPA 门槛。'
            : '了解本校保研/考研政策，算清自己的绩点位置。',
        ],
      },
      {
        period: '大二暑假',
        items: [
          `完成第一个"完整项目"：${firstCore} + 数据 + 可视化 + 3000 字报告。`,
          '把项目代码整理进 Git 仓库，写清 README（别人能跑起来才算作品）。',
        ],
      },
    ];
  }

  if (index === 2) {
    return [
      {
        period: '大三上',
        items: [
          `主攻 ${thirdCore}，把技能往"能独立负责"推。`,
          goal.degree === '考研' || goal.degree === '保研'
            ? '确定目标院校与方向，开始数学、英语的第一轮复习（考研最晚大三下必须启动）。'
            : '更新简历，投递寒假实习；同时补一个与目标岗位最相关的技能证/课程。',
          '找 2–3 位学长学姐聊真实工作内容，验证自己的想象。',
        ],
      },
      {
        period: '大三下',
        items: [
          goal.degree === '考研'
            ? '进入系统备考：数学强化 + 英语真题 + 专业课第一轮，每周固定复盘。'
            : goal.degree === '保研'
              ? '准备夏令营材料（成绩单、个人陈述、推荐信、项目总结）。'
              : '争取一段 2 个月以上的实习，哪怕远程/兼职，重点是"真实业务"。',
          `把 ${firstAdvanced} 的雏形做出来（可以是毕设预研）。`,
        ],
      },
      {
        period: '大三暑假',
        items: [
          goal.degree === '考研'
            ? '暑期强化冲刺：专业课第二轮 + 真题按套刷，开始政治。'
            : '实习转正/拿推荐信，或完成一个能讲 10 分钟的完整项目。',
          '整理作品集：3 个项目 + 1 份技能清单（含证据链接）。',
        ],
      },
    ];
  }

  return [
    {
      period: '大四上',
      items: [
        goal.degree === '考研'
          ? '报名、现场确认、初试（12 月）；考前两周只做真题与错题复盘。'
          : goal.degree === '保研'
            ? '确定录取后提前联系导师，读课题组近 3 年论文。'
            : '秋招主战场：按"岗位 JD → 简历关键词"逐条对齐，投递 30+ 家。',
        '毕设开题：选题尽量与目标岗位技能重叠，别让毕设和求职两张皮。',
      ],
    },
    {
      period: '大四下',
      items: [
        goal.degree === '考研'
          ? '初试过线则准备复试（专业课笔试 + 英语口语 + 科研经历陈述）；未过线立刻启动调剂或春招。'
          : '毕设定稿与答辩；把毕设整理成作品集里最有分量的一页。',
        `把 ${secondAdvanced} 的经验写成一份复盘文档，面试时能讲出取舍理由。`,
        '离校前完成交接：代码、数据、文档留在可复现的位置。',
      ],
    },
  ];
}

function yearObjectives(
  index: number,
  occupation: OccupationProfile,
  goal: CareerGoal,
): string[] {
  const advanced = skillNames(occupation, (level) => level === 3, 2);
  const [firstAdvanced = '核心分析能力', secondAdvanced = '完整项目能力'] = advanced;
  if (index === 0) {
    return [
      '绩点不掉队（专业前 30% 以内），为保研/考研/出国留出选择权。',
      '掌握 1 门编程语言的基础语法与调试方法。',
      `对 ${goal.direction} 方向形成基本认知：能说清它解决什么问题、需要什么人。`,
    ];
  }
  if (index === 1) {
    return [
      `把 ${firstAdvanced} 练到"能独立完成一次分析"的程度。`,
      '完成 1 个完整项目并留下可运行代码与报告。',
      '进入一个真实的科研/实践环境（实验室、项目组、竞赛队）。',
    ];
  }
  if (index === 2) {
    return [
      `把 ${secondAdvanced} 推到能对外展示的水平。`,
      goal.degree === '考研' || goal.degree === '保研'
        ? '考研/保研准备进入系统化阶段，有明确的月度进度表。'
        : '拿到 1 段与目标岗位相关的实习或等价实践。',
      '确定毕业去向（不再摇摆），并写出备选方案。',
    ];
  }
  return [
    goal.degree === '考研'
      ? '初试过线并完成复试/调剂，拿到录取或明确下一步。'
      : '拿到 1 个符合预期的 offer，或明确"先就业再调整"的路径。',
    '毕设与作品集完成，能支撑一次 30 分钟的深度面试。',
    '形成可持续的学习方法（读文献、记笔记、复盘），而不是靠 deadline 驱动。',
  ];
}

function yearDeliverables(index: number, occupation: OccupationProfile, goal: CareerGoal): string[] {
  const firstCore = skillNames(occupation, (level) => level >= 2, 1)[0] ?? '核心工具';
  if (index === 0) {
    return ['一份课程大作业的完整报告（问题→方法→结果→局限）', '一个 Git 仓库，README 能让别人跑起来'];
  }
  if (index === 1) {
    return [`一个用 ${firstCore} 完成的端到端项目`, '一份 3 页的项目总结（含失败与改进）'];
  }
  if (index === 2) {
    return [
      '作品集 v1（3 个项目 + 技能清单 + 证据链接）',
      goal.degree === '考研' || goal.degree === '保研' ? '考研/保研进度表（按月，可核对）' : '一段可写的实习经历（含具体产出）',
    ];
  }
  return [
    '毕业论文/设计（含可复现代码或数据）',
    '面试材料包：简历、项目讲解稿、常见问题答案',
  ];
}

function buildAlternatives(occupation: OccupationProfile, goal: CareerGoal): PlanAlternative[] {
  return [
    {
      name: '备选 A：同领域相邻岗位',
      trigger: '目标岗位竞争过于激烈，或实习后发现实际工作内容与预期不符',
      actions: [
        '用同一个技能栈换岗位名，而不是从零开始（例如从"算法工程师"转到"数据分析/临床数据管理"）。',
        '把已有项目改写成目标岗位的语言：同一件事，强调不同的能力。',
        '优先内部转岗或实习转正，比海投效率高。',
      ],
    },
    {
      name: '备选 B：先读研再就业',
      trigger: goal.degree === '考研' ? '初试成绩不理想但仍想留在本方向' : '发现本科学历在该方向是硬门槛',
      actions: [
        '评估二战成本：时间、经济、心理，和家人摊开谈一次。',
        '同时准备"科研助理/技术员"过渡岗位，保留再战或转岗的可能。',
        '如果决定二战，把上一次的失败原因写成清单，逐条对应改进措施。',
      ],
    },
    {
      name: '备选 C：换方向',
      trigger: `发现自己对 ${occupation.title} 的日常工作（${occupation.tasks[0] ?? '核心任务'}）持续排斥`,
      actions: [
        '重新做一次兴趣测评，对比两次结果的差异，找出真正排斥的点（是任务、环境还是人）。',
        '用"最小成本试错"：找一次实习/项目/旁听，而不是直接换专业。',
        '把已获得的通用能力（数据分析、写作、协作）迁移到新方向，别否定过去的积累。',
      ],
    },
  ];
}

/** 生成四年（或指定年数）计划。 */
export function buildFourYearPlan(options: PlanOptions): CareerPlan {
  const { goal, occupation } = options;
  const years = options.years ?? 4;
  if (years < 1 || years > YEAR_LABELS.length) {
    throw new Error(`年数必须在 1–${YEAR_LABELS.length} 之间，收到 ${years}`);
  }
  const currentSkills = options.currentSkills ?? [];
  const gapReport = findSkillGaps(occupation, currentSkills, { maxGaps: 3 });
  const warnings: string[] = [];

  if (currentSkills.length === 0) {
    warnings.push('没有填写技能证据：下面的"短板"只能按岗位要求推断，建议先补一份技能清单（技能 + 等级 + 证据）。');
  }
  const needsMaster = occupation.education.some((line) => line.includes('硕士起步') || line.includes('博士为主'));
  if (needsMaster && goal.degree === '本科就业') {
    warnings.push(`${occupation.title} 多数岗位要求硕士及以上，本科直接就业匹配度偏低；建议把考研列为并行方案。`);
  }

  const planYears: YearPlan[] = [];
  for (let index = 0; index < years; index += 1) {
    const startYear = goal.startYear + index;
    const weaknesses =
      index === 0
        ? gapReport.gaps.length > 0
          ? gapReport.gaps.map((gap) => `${gap.skill}：目前 ${gap.current}/3，岗位要求 ${gap.required}/3`)
          : ['暂无明显技能短板，注意别把时间摊太薄。']
        : [
            `检查上一年度目标是否真的完成（用交付物核对，不看"感觉进度"）。`,
            gapReport.gaps[index - 1] !== undefined
              ? `继续补 ${gapReport.gaps[index - 1]!.skill}，别让它拖到毕业前才补。`
              : '把新学的技能用项目验证一次，避免"学过但没用过"。',
          ];
    planYears.push({
      year: startYear,
      label: `${YEAR_LABELS[index]}（${startYear}–${startYear + 1}）`,
      skillTimeline: yearTimeline(index, occupation, goal),
      strengths:
        index === 0 && gapReport.strengths.length > 0
          ? gapReport.strengths.map((skill) => `${skill}：已有证据，可以在项目里继续加深`)
          : [`已完成的交付物是你唯一的证据来源：${yearDeliverables(index, occupation, goal)[0]}`],
      weaknesses,
      objectives: yearObjectives(index, occupation, goal),
      deliverables: yearDeliverables(index, occupation, goal),
    });
  }

  return {
    goal,
    occupation,
    years: planYears,
    alternatives: buildAlternatives(occupation, goal),
    warnings,
  };
}