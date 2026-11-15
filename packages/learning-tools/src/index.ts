/**
 * @dsh-learning/learning-tools
 *
 * 把五个包（scholar / carsi-router / career / paper-radar / bio-data）暴露成 DSH 工具：
 * 文献索引与带页码引用检索、全文可得性路由、检索式生成、岗位画像与四年计划、热点论文雷达、科研数据检索。
 *
 * 这个包不 import 任何 `@deepseek-ai/*`：DSH 的 Loader 从 profile 根解析模块，
 * 第三方 link 包只有自己声明的依赖能被解析到，所以工具定义用最小结构的普通对象传给
 * `ctx.tools.register()`（字段与官方 `defineTool` 的产物一致：name/description/parameters/output/execute）。
 */
import { registerAccessTools } from './tools/access.js';
import { registerBioDataTools } from './tools/biodata.js';
import { registerCareerTools } from './tools/career.js';
import { registerPaperTools } from './tools/papers.js';
import { registerRadarTools } from './tools/radar.js';
import type { PluginContext, PluginFetch, ToolsConfig } from './types.js';

export const name = 'learning-tools';

/** 只依赖 tools 服务；写错服务名不会报错、只会让插件永不激活。 */
export const inject = ['tools'];

/** 默认用宿主自带的 fetch；Node 22+ 与 Electron 都有。 */
function defaultFetch(): PluginFetch | undefined {
  const candidate = (globalThis as { fetch?: unknown }).fetch;
  if (typeof candidate !== 'function') return undefined;
  return candidate as PluginFetch;
}

export function apply(ctx: PluginContext, config?: ToolsConfig): void {
  const given: ToolsConfig = config !== null && typeof config === 'object' ? config : {};
  const settings: ToolsConfig = { ...given, ...(given.fetch === undefined ? { fetch: defaultFetch() } : {}) };
  registerPaperTools(ctx, settings);
  registerAccessTools(ctx, settings);
  registerCareerTools(ctx, settings);
  registerRadarTools(ctx, settings);
  registerBioDataTools(ctx, settings);
}

export type { PluginContext, PluginFetch, ToolDefinitionLike, ToolExec, ToolsConfig } from './types.js';
export { registerAccessTools, registerBioDataTools, registerCareerTools, registerPaperTools, registerRadarTools };