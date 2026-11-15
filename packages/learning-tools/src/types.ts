/** DSH 工具定义与插件上下文的最小类型 —— 不 import @deepseek-ai/*，避免从 profile 根解析失败。 */

export interface RenderBlock {
  type: 'text';
  text: string;
}

/** `output.schema` 只使用 DSH 支持的子集：type/properties/required/additionalProperties/items/enum/const + 注解。 */
export type JsonSchema = Record<string, unknown>;

export interface ToolExec {
  /** 调用方取消信号；长任务应转发。 */
  readonly signal?: AbortSignal;
}

export interface ToolDefinitionLike {
  name: string;
  description: string;
  parameters: JsonSchema;
  output: {
    schema: JsonSchema;
    render: (args: unknown, value: unknown) => RenderBlock[];
  };
  execute: (args: unknown, exec: ToolExec) => Promise<unknown>;
  isConcurrencySafe?: (args: unknown) => boolean;
}

export interface PluginContext {
  tools: {
    register(definition: ToolDefinitionLike, options?: { when?: (context: unknown) => boolean }): () => void;
  };
}

/** 最小 fetch 形状：paper-radar / bio-data 都只用到 ok/status/text/json 与 signal。 */
export interface PluginFetch {
  (
    input: string,
    init?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;
}

/** 插件配置（在 cordis.patch.yml 的 config 里给默认值，都可以被单次调用的参数覆盖）。 */
export interface ToolsConfig {
  zoteroDbPath?: string;
  zoteroDataDir?: string;
  indexDbPath?: string;
  contactEmail?: string;
  /** 注入用：测试里换成假 fetch；生产环境由 apply() 兜底成 globalThis.fetch。 */
  fetch?: PluginFetch;
}