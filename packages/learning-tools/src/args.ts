import type { ToolsConfig } from './types.js';

type Args = Record<string, unknown>;

function record(args: unknown): Args {
  return typeof args === 'object' && args !== null ? (args as Args) : {};
}

export function readString(args: unknown, key: string): string | undefined {
  const value = record(args)[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function readNumber(args: unknown, key: string): number | undefined {
  const value = record(args)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readNumberArray(args: unknown, key: string): number[] | undefined {
  const value = record(args)[key];
  if (!Array.isArray(value)) return undefined;
  const numbers = value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  return numbers.length === value.length ? numbers : undefined;
}

export function readArray(args: unknown, key: string): unknown[] | undefined {
  const value = record(args)[key];
  return Array.isArray(value) ? value : undefined;
}

/**
 * 取路径类参数：先看本次调用，再看插件配置；都没有就报一个能照着做的错。
 */
export function needPath(
  args: unknown,
  key: string,
  fallback: string | undefined,
  hint: string,
): string {
  const value = readString(args, key) ?? fallback;
  if (value === undefined) {
    throw new Error(`${key} 没有提供，也没有在插件配置里设置。${hint}`);
  }
  return value;
}

export function pickConfig(config: ToolsConfig | undefined): ToolsConfig {
  return config !== null && typeof config === 'object' ? config : {};
}

export function text(...lines: Array<string | undefined>): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: lines.filter((line): line is string => line !== undefined && line !== '').join('\n') }];
}

/** 校验调用参数里必填的字符串字段，用于工具自身做友好报错（DSH 也会先按 schema 校验一次）。 */
export function requireString(args: unknown, key: string, hint?: string): string {
  const value = readString(args, key);
  if (value === undefined) throw new Error(`缺少参数 ${key}${hint === undefined ? '' : `：${hint}`}`);
  return value;
}

export function formatCitations(hits: Array<{ title: string; page: number }>): string {
  return hits.map((hit) => `《${hit.title}》第 ${hit.page} 页`).join('；');
}