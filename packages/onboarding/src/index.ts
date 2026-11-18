/**
 * @dsh-learning/onboarding —— 知航的「初始化」能力。
 *
 * 这一层只做三件事，且刻意不碰 DSH API（这样它既能被插件调用，也能被 CLI/测试直接调用）：
 *   1. 定义「知航需要知道什么」——schema.ts 的字段目录（唯一的真相来源）；
 *   2. 把用户填的东西落成 workspace/学习档案/个人档案.{json,md}——profile.ts；
 *   3. 生成一份能双击打开的引导页与体检报告——wizard.ts / resources.ts。
 *
 * 主动性从哪来：persona 不再靠"问用户"，而是开场先读这份档案；档案缺什么，
 * status.nextQuestions 就直接告诉模型下一句该问哪一个。
 */
export type {
  FieldValue,
  ProfileFile,
  GroupId,
  GroupSpec,
  FieldKind,
  FieldSpec,
  GroupStat,
  ProfileStatus,
  ResourceStatus,
  ResourceCheckItem,
  ResourceCheckReport,
} from './types.js';

export { GROUPS, FIELDS, fieldByKey, fieldsOfGroup, requiredFields, questionFor } from './schema.js';

export {
  PROFILE_DIR_NAME,
  PROFILE_JSON_NAME,
  PROFILE_MD_NAME,
  WIZARD_NAME,
  GROUP_NUMERALS,
  profilePaths,
  emptyProfile,
  isFilled,
  asTextValue,
  readProfile,
  loadProfile,
  saveProfile,
  profileStatus,
} from './profile.js';

export { profileSummaryLine, renderProfileMarkdown, extractMilestones } from './render.js';
export type { RenderOptions } from './render.js';

export { checkResources } from './resources.js';
export type { ResourceCheckOptions } from './resources.js';

export { renderWizardHtml } from './wizard.js';
export type { WizardOptions } from './wizard.js';