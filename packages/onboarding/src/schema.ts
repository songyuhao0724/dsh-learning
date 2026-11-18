/**
 * 档案字段目录：一份数据，三处使用（引导页表单 / 完整度诊断 / Markdown 渲染）。
 *
 * 设计取舍：不建复杂的嵌套 schema，只用「扁平键 + 分组」。
 * 理由是这份档案要能被用户用记事本直接改，嵌套会让人不敢动。
 */
import type { FieldSpec, GroupId, GroupSpec } from './types.js';

export const GROUPS: readonly GroupSpec[] = [
  { id: 'identity', label: '我是谁', hint: '决定知航怎么称呼你、按哪个专业和年级给建议。' },
  { id: 'goal', label: '我要去哪', hint: '决定推荐什么岗位、什么技能、什么节奏的路线。' },
  { id: 'preference', label: '我怎么配合', hint: '决定知航多久提醒一次、汇报多长、说话什么风格。' },
  { id: 'resource', label: '我的资源在哪', hint: '决定文献、全文、检索式这三件事能不能真的跑起来。' },
];

export const FIELDS: readonly FieldSpec[] = [
  // ── 我是谁 ────────────────────────────────────────────────
  {
    key: 'name',
    label: '姓名',
    group: 'identity',
    kind: 'text',
    required: true,
    placeholder: '宋宇昊',
    help: '只要一个称呼也行。',
  },
  {
    key: 'school',
    label: '学校',
    group: 'identity',
    kind: 'text',
    required: true,
    placeholder: '康复大学',
    help: '写全称，知航会用它判断 CARSI 能不能用。',
  },
  {
    key: 'college',
    label: '学院',
    group: 'identity',
    kind: 'text',
    placeholder: '生命科学与健康学院',
  },
  {
    key: 'major',
    label: '专业',
    group: 'identity',
    kind: 'text',
    required: true,
    placeholder: '生物信息学',
  },
  {
    key: 'grade',
    label: '年级 / 学制',
    group: 'identity',
    kind: 'text',
    required: true,
    placeholder: '2026 级（四年制）',
    help: '「大二」这种也够用，但写上年份能算出还剩几个学期。',
  },
  {
    key: 'className',
    label: '班级',
    group: 'identity',
    kind: 'text',
    placeholder: '生物信息学二班',
  },
  {
    key: 'role',
    label: '学生工作 / 角色',
    group: 'identity',
    kind: 'text',
    placeholder: '文艺委员',
    help: '有职务就写，知航会把班级事务也纳入计划。',
  },
  {
    key: 'studentId',
    label: '学号',
    group: 'identity',
    kind: 'text',
    placeholder: '2610060205',
    help: '作业命名、报名表要用；只存在本地档案里。',
  },
  {
    key: 'politicalStatus',
    label: '政治面貌 / 发展状态',
    group: 'identity',
    kind: 'text',
    placeholder: '入党申请人',
    help: '涉及发展性测评、思想汇报时，知航会按这个节点提醒。',
  },

  // ── 我要去哪 ──────────────────────────────────────────────
  {
    key: 'degreeGoal',
    label: '毕业去向',
    group: 'goal',
    kind: 'select',
    required: true,
    options: ['考研', '保研', '本科就业', '出国'],
    help: '这一项决定四年路线怎么分叉，所以是必填。',
  },
  {
    key: 'careerDirections',
    label: '职业方向（按优先级）',
    group: 'goal',
    kind: 'text',
    required: true,
    placeholder: '医疗健康大数据、精准医疗',
    mdNote: '用「、」分隔，越靠前越优先',
    help: '写方向而不是岗位名，知航会据此匹配岗位画像。',
  },
  {
    key: 'currentFocus',
    label: '当前最想解决的一件事',
    group: 'goal',
    kind: 'text',
    required: true,
    placeholder: '把生物信息编程基础补上',
    help: '一句话就够；知航每次开场会先问这件事的进展。',
  },
  {
    key: 'weeklyHours',
    label: '每周可投入学习时间（小时）',
    group: 'goal',
    kind: 'number',
    placeholder: '15',
    help: '计划排得动排不动，主要看这个数。',
  },
  {
    key: 'weakestSkill',
    label: '最担心的短板',
    group: 'goal',
    kind: 'text',
    placeholder: '统计与实验设计',
  },
  {
    key: 'nextDeadline',
    label: '最近一个硬截止',
    group: 'goal',
    kind: 'text',
    placeholder: '12-20 发展性测评材料',
    mdNote: '格式随意，写清「时间 + 事项」',
    help: '有了它，知航开场就能直接提醒，而不是先问你。',
  },

  // ── 我怎么配合 ────────────────────────────────────────────
  {
    key: 'tone',
    label: '想要的说话风格',
    group: 'preference',
    kind: 'select',
    options: ['学长式，直接给判断', '耐心解释，先讲原理', '极简，只要结论和下一步'],
  },
  {
    key: 'remindFrequency',
    label: '主动提醒频率',
    group: 'preference',
    kind: 'select',
    options: ['每次会话都提醒', '每天提醒一次', '每周提醒一次', '只在到期前提醒'],
    help: '「主动」到什么程度由你定，知航不会越线。',
  },
  {
    key: 'reportLength',
    label: '汇报篇幅',
    group: 'preference',
    kind: 'select',
    options: ['结论先行，一两段', '给依据，中等篇幅', '完整过程都给我'],
  },

  // ── 我的资源在哪 ──────────────────────────────────────────
  {
    key: 'zoteroDbPath',
    label: 'zotero.sqlite 路径',
    group: 'resource',
    kind: 'text',
    required: true,
    placeholder: 'C:\\Users\\you\\Zotero\\zotero.sqlite',
    help: 'Zotero 数据目录里的 zotero.sqlite；知航只读，不动你的库。',
  },
  {
    key: 'zoteroDataDir',
    label: 'Zotero 数据目录',
    group: 'resource',
    kind: 'text',
    required: true,
    placeholder: 'C:\\Users\\you\\Zotero',
    help: '含 storage 文件夹的那一层。PDF 与 Zotero 的全文缓存都从这里读。',
  },
  {
    key: 'indexDbPath',
    label: '本地文献索引库路径',
    group: 'resource',
    kind: 'text',
    placeholder: '学习档案\\papers.db',
    help: '知航建的索引库（可以不存在，首次索引时创建）。',
  },
  {
    key: 'contactEmail',
    label: '联系邮箱',
    group: 'resource',
    kind: 'text',
    required: true,
    placeholder: 'you@example.edu.cn',
    help: 'Unpaywall / NCBI 要求带邮箱，缺了会拿不到开放全文。',
  },
  {
    key: 'carsiInstitution',
    label: 'CARSI 所属学校',
    group: 'resource',
    kind: 'text',
    placeholder: '康复大学',
    help: '用于资源路由时提示「先登录 CARSI 再从门户点开」。',
  },
];

const FIELD_INDEX = new Map(FIELDS.map((field) => [field.key, field]));

export function fieldByKey(key: string): FieldSpec | undefined {
  return FIELD_INDEX.get(key);
}

export function fieldsOfGroup(group: GroupId): FieldSpec[] {
  return FIELDS.filter((field) => field.group === group);
}

export function requiredFields(): FieldSpec[] {
  return FIELDS.filter((field) => field.required === true);
}

/** 字段的「问题句」——直接拿去问用户，不用再拼一遍。 */
/** 字段的「问题句」——直接拿去问用户，不用再拼一遍。 */
export function questionFor(field: FieldSpec): string {
  const options =
    field.kind === 'select' && field.options !== undefined && field.options.length > 0
      ? `可选项：${field.options.join(' / ')}。`
      : '';
  const suffix = field.help === undefined ? '' : `（${field.help}）`;
  return `你的${field.label}是？${suffix}${options}`;
}