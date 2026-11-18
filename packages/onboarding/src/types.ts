/** 个人档案与初始化向导的类型定义。 */

/** 字段取值：文本或数字。多值（如职业方向）用「、」分隔成一段文本，保证 JSON 可手改。 */
export type FieldValue = string | number;

/** 落盘的档案文件：`学习档案/个人档案.json`。 */
export interface ProfileFile {
  version: 1;
  updatedAt: string;
  /** 只存用户真的填过的字段；空值不落盘，避免「填了空字符串」被当成已回答。 */
  values: Record<string, FieldValue>;
}

export type GroupId = 'identity' | 'news' | 'goal' | 'preference' | 'resource';

export interface GroupSpec {
  id: GroupId;
  /** 中文分组名，同时用于 Markdown 小节标题。 */
  label: string;
  /** 这一组到底在问什么，给用户看的说明。 */
  hint: string;
}

export type FieldKind = 'text' | 'longtext' | 'select' | 'number';

/** 一个可填写字段的规格。向导页、完整度诊断、Markdown 渲染都从这张表派生。 */
export interface FieldSpec {
  key: string;
  label: string;
  group: GroupId;
  kind: FieldKind;
  /** 必填项直接决定完整度百分比。 */
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** 渲染 Markdown 时的行内提示（例如「用、分隔」）。 */
  mdNote?: string;
}

export interface GroupStat {
  id: GroupId;
  label: string;
  filled: number;
  total: number;
}

/** 完整度诊断结果：知航开场问什么、还差什么，全从这里读。 */
export interface ProfileStatus {
  /** 按必填项计算的完成度，0–100。 */
  completion: number;
  requiredFilled: number;
  requiredTotal: number;
  missingRequired: FieldSpec[];
  groups: GroupStat[];
  /** 最多三条、可直接拿去问用户的中文问题。 */
  nextQuestions: string[];
  ready: boolean;
  headline: string;
}

export type ResourceStatus = 'ok' | 'warn' | 'missing';

export interface ResourceCheckItem {
  key: string;
  label: string;
  status: ResourceStatus;
  detail: string;
  /** 缺了怎么补：给一条能照做的命令或操作。 */
  fix?: string;
}

export interface ResourceCheckReport {
  items: ResourceCheckItem[];
  okCount: number;
  warnCount: number;
  missingCount: number;
  headline: string;
}

/**
 * 资讯方向（`学习档案/资讯方向.json`）。
 *
 * 和 `个人档案.json` 分开存，因为它的性质不同：档案是用户逐条回答的事实，
 * 资讯方向是模型按专业拟出来的「派生物」，可以随时重新生成、也应该让人手改。
 */
export interface NewsDomainProfile {
  version: 1;
  updatedAt: string;
  /** 方向名，例如「基因组学」「医学影像 AI」。 */
  topics: string[];
  /** 匹配关键词，中英文都行（标题命中权重最高）。 */
  keywords: string[];
  /** 明确不关心的词，命中就降到末尾。 */
  exclude: string[];
  /** 一句话筛选口径，例如「只关心方法学突破，不关心融资新闻」。 */
  scoringNotes?: string;
}

export interface SaveNewsDomainResult {
  domain: NewsDomainProfile;
  file: string;
  counts: { topics: number; keywords: number; exclude: number };
}