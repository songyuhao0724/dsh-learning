/**
 * 档案的读写与完整度诊断。
 *
 * 三个约定，后面所有工具都靠它们保持一致：
 * 1) 唯一权威文件是 `学习档案/个人档案.json`，Markdown 是它的渲染副本；
 * 2) 空字符串不进 JSON（否则「问过了但没答」会被误判成已回答）；
 * 3) 每次写入都保留旧 Markdown 里的「里程碑记录」，不让历史被冲掉。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractMilestones, renderProfileMarkdown } from './render.js';
import { GROUPS, fieldByKey, fieldsOfGroup, questionFor, requiredFields } from './schema.js';
import type { FieldValue, GroupStat, NewsDomainProfile, ProfileFile, ProfileStatus, SaveNewsDomainResult } from './types.js';

export const PROFILE_DIR_NAME = '学习档案';
export const PROFILE_JSON_NAME = '个人档案.json';
export const PROFILE_MD_NAME = '个人档案.md';
export const WIZARD_NAME = '初始化向导.html';
/** 模型按专业拟出来的资讯方向，与个人档案分开存（可重新生成、可手改）。 */
export const NEWS_DOMAIN_NAME = '资讯方向.json';

export interface ProfilePaths {
  dir: string;
  json: string;
  markdown: string;
  wizard: string;
  newsDomain: string;
}

export function profilePaths(workspaceDir: string): ProfilePaths {
  const dir = join(workspaceDir, PROFILE_DIR_NAME);
  return {
    dir,
    json: join(dir, PROFILE_JSON_NAME),
    markdown: join(dir, PROFILE_MD_NAME),
    wizard: join(dir, WIZARD_NAME),
    newsDomain: join(dir, NEWS_DOMAIN_NAME),
  };
}

export function emptyProfile(now: string = new Date().toISOString()): ProfileFile {
  return { version: 1, updatedAt: now, values: {} };
}

export function isFilled(value: FieldValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return value.trim() !== '';
}

export function asTextValue(value: FieldValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export interface ReadProfileResult {
  profile: ProfileFile;
  exists: boolean;
  /** JSON 坏了的时候给出原因，让调用方决定是重写还是先备份。 */
  error?: string;
}

export function readProfile(workspaceDir: string): ReadProfileResult {
  const paths = profilePaths(workspaceDir);
  if (!existsSync(paths.json)) return { profile: emptyProfile(), exists: false };
  try {
    const raw = JSON.parse(readFileSync(paths.json, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return { profile: emptyProfile(), exists: true, error: '档案 JSON 顶层不是对象' };
    const record = raw as Partial<ProfileFile>;
    const values: Record<string, FieldValue> = {};
    for (const [key, value] of Object.entries(record.values ?? {})) {
      if (typeof value === 'string' || typeof value === 'number') values[key] = value;
    }
    return {
      profile: {
        version: 1,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
        values,
      },
      exists: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { profile: emptyProfile(), exists: true, error: `档案 JSON 解析失败：${message}` };
  }
}

export function loadProfile(workspaceDir: string): ProfileFile {
  return readProfile(workspaceDir).profile;
}

export interface SaveProfileOptions {
  now?: string;
  /** 额外追加的里程碑（例如「安装了 25 条资源目录」）。 */
  extraMilestones?: string[];
}

export interface SaveProfileResult {
  profile: ProfileFile;
  status: ProfileStatus;
  changed: string[];
  /** 不在字段目录里的键：接受但提示，避免用户写了个永远用不上的字段。 */
  ignored: string[];
  files: { json: string; markdown: string };
}

/**
 * 合并式保存：只覆盖这次给的键，其余保持原样。
 * 传空字符串或 null 表示「清空这个字段」，会从档案里删掉。
 */
export function saveProfile(
  workspaceDir: string,
  patch: Record<string, unknown>,
  options: SaveProfileOptions = {},
): SaveProfileResult {
  const paths = profilePaths(workspaceDir);
  const before = readProfile(workspaceDir);
  const now = options.now ?? new Date().toISOString();
  const values: Record<string, FieldValue> = { ...before.profile.values };
  const changed: string[] = [];
  const ignored: string[] = [];

  for (const [key, rawValue] of Object.entries(patch)) {
    const spec = fieldByKey(key);
    if (spec === undefined) {
      ignored.push(key);
      continue;
    }
    if (rawValue === null || rawValue === undefined) {
      if (values[key] !== undefined) {
        delete values[key];
        changed.push(key);
      }
      continue;
    }
    let next: FieldValue | undefined;
    if (typeof rawValue === 'number') {
      next = Number.isFinite(rawValue) ? rawValue : undefined;
    } else if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      next = trimmed === '' ? undefined : trimmed;
    } else if (typeof rawValue === 'boolean') {
      next = rawValue ? '是' : '否';
    } else {
      ignored.push(key);
      continue;
    }
    if (next === undefined) {
      if (values[key] !== undefined) {
        delete values[key];
        changed.push(key);
      }
      continue;
    }
    if (values[key] !== next) {
      values[key] = next;
      changed.push(key);
    }
  }

  const profile: ProfileFile = { version: 1, updatedAt: now, values };
  mkdirSync(paths.dir, { recursive: true });

  const oldMarkdown = existsSync(paths.markdown) ? readFileSync(paths.markdown, 'utf8') : '';
  const milestones = [...extractMilestones(oldMarkdown), ...(options.extraMilestones ?? [])];
  const markdown = renderProfileMarkdown(profile, { milestones, generatedAt: now });

  writeFileSync(paths.json, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  writeFileSync(paths.markdown, markdown, 'utf8');

  return {
    profile,
    status: profileStatus(profile),
    changed,
    ignored,
    files: { json: paths.json, markdown: paths.markdown },
  };
}

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 与 `@dsh-learning/feeds` 的 `normalizeDomain()` 保持同一口径：方向 ≤12、关键词 ≤40、单词 ≤40 字。 */
const MAX_DOMAIN_TOPICS = 12;
const MAX_DOMAIN_TERMS = 40;
const MAX_TERM_LENGTH = 40;

function cleanDomainTerms(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const term = value.replace(/\s+/g, ' ').trim();
    if (term === '' || term.length > MAX_TERM_LENGTH) continue;
    if (out.some((existing) => existing.toLowerCase() === term.toLowerCase())) continue;
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

export interface ReadNewsDomainResult {
  domain?: NewsDomainProfile;
  file: string;
  exists: boolean;
  error?: string;
}

/** 读资讯方向；文件不存在或坏了都只是「还没有」，不抛错。 */
export function readNewsDomain(workspaceDir: string): ReadNewsDomainResult {
  const file = profilePaths(workspaceDir).newsDomain;
  if (!existsSync(file)) return { file, exists: false };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<NewsDomainProfile>;
    const notes = typeof raw.scoringNotes === 'string' ? raw.scoringNotes.trim() : '';
    const domain: NewsDomainProfile = {
      version: 1,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      topics: cleanDomainTerms(raw.topics, MAX_DOMAIN_TOPICS),
      keywords: cleanDomainTerms(raw.keywords, MAX_DOMAIN_TERMS),
      exclude: cleanDomainTerms(raw.exclude, MAX_DOMAIN_TERMS),
    };
    if (notes !== '') domain.scoringNotes = notes.slice(0, 500);
    return { domain, file, exists: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file, exists: true, error: `资讯方向 JSON 解析失败：${message}` };
  }
}

/**
 * 写资讯方向。这是模型在初始化阶段「按专业重写提示词」的落点：
 * 用户答完专业方向后，模型据此生成 topics/keywords/exclude，写进这里，
 * 后续检索按它加权（见 `@dsh-learning/feeds` 的 `rankByDomain`）。
 */
export function saveNewsDomain(
  workspaceDir: string,
  input: { topics?: unknown; keywords?: unknown; exclude?: unknown; scoringNotes?: unknown },
  options: { now?: string } = {},
): SaveNewsDomainResult {
  const paths = profilePaths(workspaceDir);
  const now = options.now ?? new Date().toISOString();
  const domain: NewsDomainProfile = {
    version: 1,
    updatedAt: now,
    topics: cleanDomainTerms(input.topics, MAX_DOMAIN_TOPICS),
    keywords: cleanDomainTerms(input.keywords, MAX_DOMAIN_TERMS),
    exclude: cleanDomainTerms(input.exclude, MAX_DOMAIN_TERMS),
  };
  const notes = typeof input.scoringNotes === 'string' ? input.scoringNotes.trim() : '';
  if (notes !== '') domain.scoringNotes = notes.slice(0, 500);

  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.newsDomain, `${JSON.stringify(domain, null, 2)}\n`, 'utf8');
  return {
    domain,
    file: paths.newsDomain,
    counts: {
      topics: domain.topics.length,
      keywords: domain.keywords.length,
      exclude: domain.exclude.length,
    },
  };
}

/** 完整度诊断：知航开场就该拿这个，而不是从零开始问。 */
export function profileStatus(profile: ProfileFile): ProfileStatus {
  const required = requiredFields();
  const filledRequired = required.filter((field) => isFilled(profile.values[field.key]));
  const missingRequired = required.filter((field) => !isFilled(profile.values[field.key]));
  const requiredTotal = required.length;
  const completion = requiredTotal === 0 ? 100 : Math.round((filledRequired.length / requiredTotal) * 100);

  const groups: GroupStat[] = GROUPS.map((group) => {
    const fields = fieldsOfGroup(group.id);
    const filled = fields.filter((field) => isFilled(profile.values[field.key])).length;
    return { id: group.id, label: group.label, filled, total: fields.length };
  });

  const ready = missingRequired.length === 0;
  const headline = ready
    ? `档案已完整（必填 ${requiredTotal}/${requiredTotal}），可以直接按你的真实情况给建议。`
    : `必填项 ${filledRequired.length}/${requiredTotal}（完整度 ${completion}%），还差：${missingRequired
        .map((field) => field.label)
        .join('、')}`;

  return {
    completion,
    requiredFilled: filledRequired.length,
    requiredTotal,
    missingRequired,
    groups,
    nextQuestions: missingRequired.slice(0, 3).map((field) => questionFor(field)),
    ready,
    headline,
  };
}

export { CN_NUM as GROUP_NUMERALS };