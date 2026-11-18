/**
 * 把档案渲染成人能读的 Markdown。
 *
 * 为什么还要 Markdown：用户（和学生家长、老师）会直接打开文件看，
 * 而 JSON 只适合程序读。两份文件由同一次 save 同时写出，永远不会只更新一份。
 */
import { GROUPS, fieldsOfGroup } from './schema.js';
import type { FieldValue, ProfileFile } from './types.js';

export interface RenderOptions {
  /** 从旧档案里保留的里程碑条目（纯文本行，不带 `- ` 前缀也行）。 */
  milestones?: string[];
  /** 覆盖「更新于」时间，测试用。 */
  generatedAt?: string;
}

function asText(value: FieldValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 一句话画像：档案够用时，知航开场可以直接用这句，而不是复述整张表。 */
export function profileSummaryLine(profile: ProfileFile): string {
  const v = (key: string): string | undefined => asText(profile.values[key]);
  const parts = [v('name'), v('school'), v('major'), v('grade'), v('degreeGoal'), v('careerDirections')].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length === 0 ? '（档案还是空的）' : parts.join(' · ');
}

export function renderProfileMarkdown(profile: ProfileFile, options: RenderOptions = {}): string {
  const lines: string[] = [];
  const name = asText(profile.values['name']) ?? '我';
  const updated = options.generatedAt ?? profile.updatedAt;

  lines.push(`# ${name} · 个人档案（AI 伴学助手知识库）`, '');
  lines.push('> 本文件由「知航」维护；同目录的 `个人档案.json` 是机器可读版本，两者由同一次写入生成，内容一致。');
  lines.push(`> 最后更新：${formatStamp(updated)}`);
  lines.push('> 想改内容：直接改这个文件，或让知航运行 `study_profile_save`；也可以用同目录的 `初始化向导.html` 一次性填。');
  lines.push('');

  GROUPS.forEach((group, index) => {
    const fields = fieldsOfGroup(group.id);
    const filled = fields
      .map((field) => ({ field, value: asText(profile.values[field.key]) }))
      .filter((entry): entry is { field: (typeof fields)[number]; value: string } => entry.value !== undefined);

    lines.push(`## ${CN_NUM[index] ?? String(index + 1)}、${group.label}`, '');
    if (filled.length === 0) {
      lines.push(`_（还没填。${group.hint}）_`, '');
    } else {
      lines.push('| 项目 | 内容 |', '|---|---|');
      for (const entry of filled) {
        const note = entry.field.mdNote === undefined ? '' : `（${entry.field.mdNote}）`;
        lines.push(`| ${entry.field.label}${note} | ${entry.value.replace(/\|/g, '\\|')} |`);
      }
      lines.push('');
      const missing = fields.filter((field) => asText(profile.values[field.key]) === undefined);
      if (missing.length > 0) {
        lines.push(`未填：${missing.map((field) => field.label).join('、')}`, '');
      }
    }
  });

  const milestones = (options.milestones ?? []).map((line) => line.trim()).filter((line) => line !== '');
  lines.push(`## ${CN_NUM[GROUPS.length] ?? 'N'}、里程碑记录`, '');
  if (milestones.length === 0) {
    lines.push('- （还没有记录。知航会在完成一件值得记住的事之后补一行。）', '');
  } else {
    for (const line of milestones) {
      lines.push(line.startsWith('- ') || line.startsWith('* ') ? line : `- ${line}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/** 从旧 Markdown 里抠出「里程碑记录」小节，避免每次重写档案都把历史冲掉。 */
export function extractMilestones(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^#{1,3}\s/.test(line) && line.includes('里程碑'));
  if (startIndex === -1) return [];
  const collected: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    if (/^#{1,3}\s/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('>')) continue;
    collected.push(trimmed);
  }
  return collected;
}