/**
 * 档案与资源初始化工具。
 *
 * 这一组是「主动性」的支点：知航开场先跑 status，就知道自己缺什么、下一句该问哪一个，
 * 而不是每次都从"你能介绍一下自己吗"开始。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  WIZARD_NAME,
  checkResources,
  loadProfile,
  profilePaths,
  profileStatus,
  profileSummaryLine,
  renderWizardHtml,
  saveProfile,
} from '@dsh-learning/onboarding';
import { pickConfig, readArray, readString, text } from '../args.js';
import type { JsonSchema, PluginContext, ToolDefinitionLike, ToolsConfig } from '../types.js';

const OBJECT: JsonSchema = { type: 'object' };

export type Register = (definition: ToolDefinitionLike) => unknown;

function workspaceOf(args: unknown, config: ToolsConfig): string {
  return resolve(readString(args, 'workspaceDir') ?? config.workspaceDir ?? process.cwd());
}

function stringPatch(args: unknown): Record<string, unknown> {
  const raw = (args as { updates?: unknown } | null)?.updates;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('updates 必须是一个对象，例如 {"degreeGoal":"考研","currentFocus":"考研数学"}');
  }
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || value === null) patch[key] = value;
    else patch[key] = JSON.stringify(value);
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('updates 是空的：没有要更新的字段。先跑 study_profile_status 看看还差什么。');
  }
  return patch;
}

function milestonesOf(args: unknown): string[] | undefined {
  const list = readArray(args, 'milestones');
  if (list === undefined) return undefined;
  const lines = list.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return lines.length === 0 ? undefined : lines;
}

const STATUS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    workspaceDir: { type: 'string', description: '工作区目录（默认当前目录）' },
  },
};

const SAVE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    updates: {
      type: 'object',
      description: '要更新的字段，例如 {"school":"康复大学","degreeGoal":"考研"}；空字符串表示清空',
      additionalProperties: { type: 'string' },
    },
    milestones: {
      type: 'array',
      items: { type: 'string' },
      description: '追加到「里程碑记录」的行',
    },
    workspaceDir: { type: 'string', description: '工作区目录（默认当前目录）' },
  },
  required: ['updates'],
};

const WIZARD_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    workspaceDir: { type: 'string', description: '工作区目录（默认当前目录）' },
    showCheck: { type: 'boolean', description: '页面里是否附资源体检（默认 true）' },
  },
};

export function registerProfileTools(ctx: PluginContext, config: ToolsConfig = {}): void {
  const settings = pickConfig(config);
  const register: Register = (definition) => ctx.tools.register(definition);

  register({
    name: 'study_profile_status',
    description:
      '读取「学习档案/个人档案.json」，给出必填完成度、还缺哪些字段、以及下一句该问用户的 3 个问题。任何会话开场都应先调用它：档案完整就按真实情况办事，不完整就先把缺口补上，不要重复问已经答过的。',
    parameters: STATUS_SCHEMA,
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const data = value as {
          summary: string;
          completion: number;
          requiredFilled: number;
          requiredTotal: number;
          missing: Array<{ key: string; label: string }>;
          nextQuestions: string[];
          groups: Array<{ label: string; filled: number; total: number }>;
          files: { markdown: string };
        };
        const lines = [
          `## 档案完整度 ${data.completion}%（必填 ${data.requiredFilled}/${data.requiredTotal}）`,
          '',
          `一句话画像：${data.summary}`,
          '',
          '| 分组 | 已填 |',
          '|---|---|',
          ...data.groups.map((group) => `| ${group.label} | ${group.filled}/${group.total} |`),
        ];
        if (data.missing.length === 0) {
          lines.push('', '✅ 必填项已齐——直接按档案给建议，不用再问基础信息。');
        } else {
          lines.push('', `还差：${data.missing.map((field) => field.label).join('、')}`, '', '下一句可以问：');
          for (const question of data.nextQuestions) lines.push(`- ${question}`);
        }
        lines.push('', `档案文件：${data.files.markdown}`);
        return text(...lines);
      },
    },
    execute: async (args: unknown) => {
      const workspaceDir = workspaceOf(args, settings);
      const profile = loadProfile(workspaceDir);
      const status = profileStatus(profile);
      const paths = profilePaths(workspaceDir);
      return {
        workspaceDir,
        summary: profileSummaryLine(profile),
        values: profile.values,
        completion: status.completion,
        requiredFilled: status.requiredFilled,
        requiredTotal: status.requiredTotal,
        missing: status.missingRequired.map((field) => ({ key: field.key, label: field.label })),
        nextQuestions: status.nextQuestions,
        groups: status.groups,
        headline: status.headline,
        files: { json: paths.json, markdown: paths.markdown, wizard: paths.wizard },
      };
    },
  });

  register({
    name: 'study_profile_save',
    description:
      '把用户刚说出的信息写进「学习档案/个人档案」（同时更新 个人档案.json 与 个人档案.md）。只传这次真正变化的字段；空字符串表示清空该字段。写完返回新的完成度与仍然缺的项——用它的返回值决定下一句问什么。',
    parameters: SAVE_SCHEMA,
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const data = value as {
          changed: string[];
          ignored: string[];
          completion: number;
          missing: string[];
          nextQuestions: string[];
          files: { markdown: string };
        };
        const lines = [
          data.changed.length === 0 ? '没有字段发生变化。' : `已更新 ${data.changed.length} 个字段：${data.changed.join('、')}`,
        ];
        if (data.ignored.length > 0) {
          lines.push(
            '',
            `⚠️ 这些键不在字段目录里，已忽略：${data.ignored.join('、')}`,
            '如果确实需要，先在 onboarding 的 schema.ts 里加字段，否则它永远不会被读到。',
          );
        }
        lines.push('', `档案完整度：${data.completion}%`);
        if (data.missing.length > 0) {
          lines.push(`还差：${data.missing.join('、')}`);
          if (data.nextQuestions.length > 0) {
            lines.push('', '下一句可以问：');
            for (const question of data.nextQuestions) lines.push(`- ${question}`);
          }
        } else {
          lines.push('✅ 必填项已齐。');
        }
        lines.push('', `档案文件：${data.files.markdown}`);
        return text(...lines);
      },
    },
    execute: async (args: unknown) => {
      const workspaceDir = workspaceOf(args, settings);
      const result = saveProfile(workspaceDir, stringPatch(args), { extraMilestones: milestonesOf(args) });
      return {
        changed: result.changed,
        ignored: result.ignored,
        completion: result.status.completion,
        missing: result.status.missingRequired.map((field) => field.label),
        nextQuestions: result.status.nextQuestions,
        files: result.files,
      };
    },
  });

  register({
    name: 'study_resource_check',
    description:
      '体检用户的「资源」配置：Zotero 数据库与数据目录是否真的存在、索引库是否就绪、联系邮箱格式、CARSI 学校。只读，不创建任何文件。没填的项直接告诉用户去哪里找。',
    parameters: STATUS_SCHEMA,
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const data = value as {
          headline: string;
          items: Array<{ label: string; status: string; detail: string; fix?: string }>;
        };
        const dot = (status: string): string => (status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌');
        const lines = [`## 资源体检：${data.headline}`, ''];
        for (const item of data.items) {
          lines.push(`${dot(item.status)} **${item.label}** — ${item.detail}`);
          if (item.fix !== undefined) lines.push(`   怎么补：${item.fix}`);
        }
        const blocking = data.items.filter((item) => item.status === 'missing').length;
        lines.push('', blocking === 0 ? '没有硬缺失项，可以开始用。' : `有 ${blocking} 项缺失：先把它们补上，否则文献相关的工具会打折。`);
        return text(...lines);
      },
    },
    execute: async (args: unknown) => {
      const workspaceDir = workspaceOf(args, settings);
      const values = loadProfile(workspaceDir).values;
      return { workspaceDir, ...checkResources(values) };
    },
  });

  register({
    name: 'study_profile_wizard',
    description:
      '生成/刷新「学习档案/初始化向导.html」：双击就能打开的引导页，左侧按四组填表、右侧实时预览档案、顶部环形进度、底部资源体检。用户说「不知道填什么」「表格太长」「想一次填完」时用它。',
    parameters: WIZARD_SCHEMA,
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const data = value as { path: string; bytes: number; completion: number; missing: string[] };
        const lines = [
          `已生成引导页：${data.path}（${Math.round(data.bytes / 1024)} KB）`,
          '',
          `当前必填完成度 ${data.completion}%${data.missing.length > 0 ? `，还差：${data.missing.join('、')}` : '，必填已齐'}。`,
          '',
          '打开方式：在文件管理器里双击这个 .html 文件（离线可用，不上传任何内容）。',
          '填完点「下载 个人档案.json」，覆盖到 学习档案/ 目录，再让我跑一次 study_profile_status 即可。',
        ];
        return text(...lines);
      },
    },
    execute: async (args: unknown) => {
      const workspaceDir = workspaceOf(args, settings);
      const showCheck = (args as { showCheck?: unknown } | null)?.showCheck !== false;
      const profile = loadProfile(workspaceDir);
      const status = profileStatus(profile);
      const report = showCheck ? checkResources(profile.values) : undefined;
      const html = renderWizardHtml({ profile, status, resources: report?.items });
      const paths = profilePaths(workspaceDir);
      writeFileSync(paths.wizard, html, 'utf8');
      return {
        path: paths.wizard,
        fileName: WIZARD_NAME,
        bytes: Buffer.byteLength(html, 'utf8'),
        completion: status.completion,
        missing: status.missingRequired.map((field) => field.label),
        requiredTotal: status.requiredTotal,
        profileJson: paths.json,
        hint: `在文件管理器里双击打开：${paths.wizard}`,
      };
    },
  });
}