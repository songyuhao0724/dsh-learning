import { join, resolve } from 'node:path';
import {
  FeedStore,
  FEED_GROUPS,
  FEED_SOURCES,
  normalizeDomain,
  rankByDomain,
  refreshFeeds,
  resolveSources,
  sourcesByGroup,
  withTimeoutSignal,
} from '@dsh-learning/feeds';
import type { DomainProfile, FeedSource, StoredFeedItem } from '@dsh-learning/feeds';
import { PROFILE_DIR_NAME, readNewsDomain, saveNewsDomain } from '@dsh-learning/onboarding';
import { readArray, readNumber, readString, text } from '../args.js';
import type { JsonSchema, PluginContext, PluginFetch, ToolExec, ToolsConfig } from '../types.js';

const OBJECT = { type: 'object' } as const;
const DEFAULT_AIHOT_BASE = 'http://127.0.0.1:3000';
const FEEDS_DB_NAME = '资讯.db';

function readStringArray(args: unknown, key: string): string[] | undefined {
  const value = readArray(args, key);
  if (value === undefined) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
  return items.length === 0 ? undefined : items;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function workspaceOf(args: unknown, config: ToolsConfig): string {
  return resolve(readString(args, 'workspaceDir') ?? config.workspaceDir ?? process.cwd());
}

function feedsDbOf(args: unknown, config: ToolsConfig, workspaceDir: string): string {
  return resolve(readString(args, 'dbPath') ?? config.feedsDbPath ?? join(workspaceDir, PROFILE_DIR_NAME, FEEDS_DB_NAME));
}

function aihotBaseOf(args: unknown, config: ToolsConfig): string {
  const raw = readString(args, 'baseUrl') ?? config.aihotBaseUrl ?? process.env.ZHIHANG_AIHOT_BASE ?? DEFAULT_AIHOT_BASE;
  return raw.replace(/\/+$/, '');
}

function fetchOf(config: ToolsConfig): PluginFetch {
  const injected = config.fetch;
  if (injected !== undefined) return injected;
  const native = (globalThis as { fetch?: PluginFetch }).fetch;
  if (native === undefined) throw new Error('当前运行环境没有 fetch，无法抓取网络内容。');
  return native;
}

/** 读用户方向（模型写的那份），读不到就是「还没生成」，不报错。 */
function domainOf(workspaceDir: string): { domain?: DomainProfile; exists: boolean } {
  const result = readNewsDomain(workspaceDir);
  if (result.domain === undefined) return { exists: result.exists };
  return { domain: normalizeDomain(result.domain), exists: true };
}

function shortDate(value: string | undefined): string {
  if (value === undefined || value === '') return '无日期';
  return value.slice(0, 10);
}

function clipText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

// ── AIHOT 实例（路线 A：直接问已经跑起来的 AIHOT） ──────────────────────

interface AihotNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt?: string;
  category?: string;
  score?: number;
  selected: boolean;
}

function toNewsItem(raw: unknown): AihotNewsItem | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title : '';
  if (title === '') return undefined;
  const source = typeof record.source === 'object' && record.source !== null ? (record.source as { name?: unknown }).name : undefined;
  const links = typeof record.links === 'object' && record.links !== null ? (record.links as Record<string, unknown>) : {};
  const item: AihotNewsItem = {
    id: typeof record.id === 'string' ? record.id : '',
    title,
    summary: typeof record.summary === 'string' ? record.summary : '',
    source: typeof source === 'string' ? source : '未知来源',
    url: typeof links.original === 'string' ? links.original : typeof links.aihot === 'string' ? links.aihot : '',
    selected: record.selected === true,
  };
  if (typeof record.publishedAt === 'string') item.publishedAt = record.publishedAt;
  if (typeof record.category === 'string') item.category = record.category;
  if (typeof record.score === 'number') item.score = record.score;
  return item;
}

function registerNewsTool(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_news',
    description:
      '从本机 AIHOT 实例（默认 http://127.0.0.1:3000）读它已经抓取、筛选、翻译并评分的资讯：外国厂商博客、研究机构、期刊与媒体都在里面，条目已去重、带中文摘要与分数。适合回答「最近这个领域发生了什么」。读不到时改用知航自带的 study_feeds_refresh + study_feeds_search（不需要 AIHOT）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: '关键词（2–200 字），例如 single cell、genome assembly；不给就是最新。' },
        category: { type: 'string', description: '分类过滤，例如 paper、model、company、tool。' },
        window: { type: 'string', enum: ['24h', '7d'], description: '时间窗，默认 7d。' },
        mode: { type: 'string', enum: ['selected', 'all'], description: 'selected 只给精选（默认），all 给全部已抓取的。' },
        limit: { type: 'number', description: '最多几条，1–100，默认 10。' },
        baseUrl: { type: 'string', description: `AIHOT 地址，默认 ${DEFAULT_AIHOT_BASE}。` },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          base: string;
          mode: string;
          window: string;
          query?: string;
          count: number;
          items: AihotNewsItem[];
        };
        const head = `AIHOT（${result.base}）· ${result.count} 条 · ${result.mode} / ${result.window}${
          result.query === undefined ? '' : ` / q=${result.query}`
        }`;
        if (result.items.length === 0) {
          return text(
            `${head}（空）`,
            'AIHOT 里还没有符合条件的条目：它要先自己爬一轮（api/worker 起来后几分钟内会有内容）；也可以换 mode=all 或 window=7d 再看。',
          );
        }
        const lines: Array<string | undefined> = [head];
        result.items.forEach((item, index) => {
          const meta = [item.source, shortDate(item.publishedAt), item.category, item.score === undefined ? undefined : `分数 ${item.score}`]
            .filter((part): part is string => part !== undefined && part !== '')
            .join('｜');
          lines.push(`${index + 1}. ${item.title}\n   ${meta}${item.url === '' ? '' : `\n   ${item.url}`}`);
          if (item.summary !== '') lines.push(`   ${clipText(item.summary, 160)}`);
        });
        lines.push('想看某条细节就让用户点上面的原文链接；换关键词用 query，想看更早的用 window=7d / mode=all。');
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: ToolExec) {
      const base = aihotBaseOf(args, config);
      const mode = readString(args, 'mode') === 'all' ? 'all' : 'selected';
      const window = readString(args, 'window') === '24h' ? '24h' : '7d';
      const limit = clamp(readNumber(args, 'limit') ?? 10, 1, 100);
      const query = readString(args, 'query');
      const category = readString(args, 'category');

      const params = new URLSearchParams({ mode, window, limit: String(limit) });
      if (query !== undefined) params.set('q', query);
      if (category !== undefined) params.set('category', category);
      const url = `${base}/api/v1/items?${params.toString()}`;

      const { signal, done } = withTimeoutSignal(exec.signal, 20_000);
      let response: Awaited<ReturnType<PluginFetch>>;
      try {
        response = await fetchOf(config)(url, { signal, headers: { accept: 'application/json' } });
      } catch (error) {
        done();
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `连不上 AIHOT（${base}，${reason}）。两条路：① 先把 AIHOT 启动起来（在 AIHOT 目录执行 docker compose up -d，等 /api/health 返回 200）；② 不用 AIHOT，改用知航自带的免费信源：study_feeds_refresh 抓一轮，再 study_feeds_search 检索。`,
        );
      }
      let raw = '';
      try {
        raw = await response.text();
      } finally {
        done();
      }
      if (!response.ok) {
        throw new Error(`AIHOT 返回 HTTP ${response.status}：${clipText(raw, 200)}。参数检查：q 需 2–200 字，limit 需 1–100。`);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(`AIHOT 返回的不是 JSON：${clipText(raw, 200)}`);
      }
      const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
      const rawItems = Array.isArray(record.items) ? record.items : [];
      const items = rawItems.map(toNewsItem).filter((item): item is AihotNewsItem => item !== undefined);
      return { base, mode, window, limit, ...(query === undefined ? {} : { query }), ...(category === undefined ? {} : { category }), count: items.length, items };
    },
  });
}

// ── 内置信源（路线 B：不依赖 AIHOT，直接抓免费源并本地累积） ──────────────

function registerRefreshTool(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_feeds_refresh',
    description:
      '抓取知航内置的免费外国信源（期刊 PLOS/Nature/Cell、bioRxiv 预印本、OpenAI/DeepMind/HuggingFace 等厂商博客、媒体与社区，共 ' +
      String(FEED_SOURCES.length) +
      ' 个），把新条目存进本地 SQLite 再返回结果。不需要 AIHOT、不需要学校订阅、不需要 API key，只要联网。首次抓取会把各源已有的历史条目一起收进来。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sources: { type: 'array', items: { type: 'string' }, description: '只抓这些信源 id（先看 study_feeds_sources）。不给就抓全部。' },
        group: { type: 'string', description: `只抓某一组：${FEED_GROUPS.join(' / ')}。` },
        perSource: { type: 'number', description: '每个源最多入库几条，默认 30。' },
        workspaceDir: { type: 'string', description: '工作区目录（库默认放 <工作区>/学习档案/资讯.db）。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          db: string;
          report: { added: number; failed: number; results: Array<{ sourceId: string; name: string; ok: boolean; added: number; seen: number; error?: string }> };
          stats: { items: number; sources: number };
          unknown: string[];
        };
        const lines: Array<string | undefined> = [];
        for (const item of result.report.results) {
          lines.push(
            `${item.ok ? '✓' : '✗'} ${item.name}：${item.ok ? `新增 ${item.added} 条（解析 ${item.seen}）` : (item.error ?? '失败')}`,
          );
        }
        if (result.unknown.length > 0) lines.push(`未知信源 id：${result.unknown.join('、')}`);
        lines.push(
          '',
          `本轮新增 ${result.report.added} 条，失败 ${result.report.failed} 个源；库内共 ${result.stats.items} 条 / ${result.stats.sources} 个源。`,
        );
        if (result.report.failed === result.report.results.length && result.report.results.length > 0) {
          lines.push('全部失败通常是网络问题（这些源大多在国外）：确认能访问外网后重试；单个源失败不影响其它源。');
        }
        lines.push('下一步：study_feeds_search 检索（会按用户的资讯方向加权），或 study_feeds_sources 看有哪些源。');
        return text(...lines);
      },
    },
    isConcurrencySafe: () => false,
    async execute(args: unknown, exec: ToolExec) {
      const workspaceDir = workspaceOf(args, config);
      const dbPath = feedsDbOf(args, config, workspaceDir);
      const group = readString(args, 'group');
      const requested = readStringArray(args, 'sources');
      let picked: FeedSource[];
      let unknown: string[] = [];
      if (group !== undefined) {
        if (!FEED_GROUPS.includes(group)) {
          throw new Error(`没有「${group}」这一组。可选：${FEED_GROUPS.join(' / ')}`);
        }
        picked = sourcesByGroup(group);
      } else {
        const resolved = resolveSources(requested);
        picked = resolved.picked;
        unknown = resolved.unknown;
        if (picked.length === 0) throw new Error(`这些信源 id 都不认识：${unknown.join('、')}。先用 study_feeds_sources 看可选 id。`);
      }
      const store = new FeedStore(dbPath);
      try {
        const report = await refreshFeeds({
          store,
          fetch: fetchOf(config),
          sources: picked,
          perSource: clamp(readNumber(args, 'perSource') ?? 30, 1, 100),
          ...(exec.signal === undefined ? {} : { signal: exec.signal }),
        });
        return { db: dbPath, report, stats: store.stats(), unknown };
      } finally {
        store.close();
      }
    },
  });
}

function registerSearchTool(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_feeds_search',
    description:
      '在本地累积的免费信源库里检索资讯（study_feeds_refresh 抓下来的），按时间倒序、按用户的「资讯方向」加权，返回标题/摘要/来源/日期/原文链接。不需要 AIHOT。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: '关键词，中英文都行（例如 single cell、基因组组装）；不给就按时间给最近的。' },
        since: { type: 'string', description: '只看这个日期之后，YYYY-MM-DD。' },
        limit: { type: 'number', description: '最多几条，1–100，默认 10。' },
        sourceIds: { type: 'array', items: { type: 'string' }, description: '只看这些信源 id。' },
        topics: { type: 'array', items: { type: 'string' }, description: '只看这些主题标签（如 基因组学、大模型）。' },
        domainOnly: { type: 'boolean', description: 'true 时只返回命中用户资讯方向的条目。' },
        workspaceDir: { type: 'string', description: '工作区目录。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          count: number;
          query?: string;
          db: string;
          domain?: { topics: string[]; keywords: string[] };
          items: Array<StoredFeedItem & { domainScore: number; domainHits: string[] }>;
        };
        const head =
          result.count === 0
            ? `库内没有命中${result.query === undefined ? '' : `「${result.query}」`}的条目（库：${result.db}）。`
            : `命中 ${result.count} 条${result.query === undefined ? '' : `（${result.query}）`}${
                result.domain === undefined ? '' : '，已按你的资讯方向加权'
              }：`;
        const lines: Array<string | undefined> = [head];
        for (const item of result.items) {
          const badge = item.domainScore > 0 ? `［方向 +${item.domainScore}］` : '';
          lines.push(`- ${badge}${item.title}\n  ${item.sourceId}｜${shortDate(item.publishedAt ?? item.fetchedAt)}${item.url === '' ? '' : `｜${item.url}`}`);
          if (item.summary !== '') lines.push(`  ${clipText(item.summary, 150)}`);
        }
        if (result.count === 0) lines.push('先跑一次 study_feeds_refresh，或者放宽关键词/去掉 since。');
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args: unknown) {
      const workspaceDir = workspaceOf(args, config);
      const dbPath = feedsDbOf(args, config, workspaceDir);
      const store = new FeedStore(dbPath);
      try {
        const query = readString(args, 'query');
        const since = readString(args, 'since');
        const sourceIds = readStringArray(args, 'sourceIds');
        const topics = readStringArray(args, 'topics');
        const rows = store.search({
          ...(query === undefined ? {} : { query }),
          ...(since === undefined ? {} : { since }),
          ...(sourceIds === undefined ? {} : { sourceIds }),
          ...(topics === undefined ? {} : { topics }),
          limit: clamp(readNumber(args, 'limit') ?? 10, 1, 100),
        });
        const { domain, exists } = domainOf(workspaceDir);
        const ranked = rankByDomain(rows, domain);
        const domainOnly = (args as Record<string, unknown> | null)?.domainOnly === true;
        const items = domainOnly ? ranked.filter((item) => item.domainScore > 0) : ranked;
        return {
          db: dbPath,
          count: items.length,
          ...(query === undefined ? {} : { query }),
          ...(domain === undefined ? {} : { domain: { topics: domain.topics, keywords: domain.keywords } }),
          domainReady: exists && domain !== undefined,
          items,
        };
      } finally {
        store.close();
      }
    },
  });
}

function registerSourcesTool(ctx: PluginContext): void {
  ctx.tools.register({
    name: 'study_feeds_sources',
    description: '列出知航内置的免费外国信源（分组、id、覆盖方向），用来说明「这条资讯是从哪来的」或挑要抓哪些源。不联网。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as { count: number; groups: Array<{ group: string; sources: Array<{ id: string; name: string; topics: string[] }> }> };
        const lines: Array<string | undefined> = [`共 ${result.count} 个信源（全部免费公开，不需要学校订阅）：`];
        for (const entry of result.groups) {
          lines.push('', `${entry.group}（${entry.sources.length}）`);
          for (const source of entry.sources) {
            lines.push(`- ${source.id}｜${source.name}${source.topics.length === 0 ? '' : `｜${source.topics.join('、')}`}`);
          }
        }
        lines.push('', '抓取用 study_feeds_refresh（可带 sources 或 group 只抓一部分）。');
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute() {
      const groups = FEED_GROUPS.map((group) => ({
        group,
        sources: sourcesByGroup(group).map((source) => ({ id: source.id, name: source.name, topics: source.topics })),
      })).filter((entry) => entry.sources.length > 0);
      return { count: FEED_SOURCES.length, groups };
    },
  });
}

function registerDomainTool(ctx: PluginContext, config: ToolsConfig): void {
  ctx.tools.register({
    name: 'study_news_domain_save',
    description:
      '把「按这个专业该怎么筛外国资讯」写成 学习档案/资讯方向.json：方向名、检索关键词、排除词、一句话筛选口径。初始化时用户说要资讯雷达后，由模型按他的专业/年级/职业方向生成一次；用户改主意可以再调一次覆盖。写完后 study_feeds_search 会按它加权。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topics: { type: 'array', items: { type: 'string' }, description: '方向名，3–6 个，例如 基因组学、单细胞、医学影像 AI。' },
        keywords: { type: 'array', items: { type: 'string' }, description: '匹配关键词，8–20 个；英文专有名词优先（这些源都是英文）。' },
        exclude: { type: 'array', items: { type: 'string' }, description: '不关心的词，例如 融资、裁员、加密货币。' },
        scoringNotes: { type: 'string', description: '一句话筛选口径，例如「只关心方法学突破与工具发布，不关心商业新闻」。' },
        workspaceDir: { type: 'string', description: '工作区目录。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          file: string;
          counts: { topics: number; keywords: number; exclude: number };
          domain: { topics: string[]; keywords: string[]; exclude: string[]; scoringNotes?: string };
        };
        return text(
          `已写入资讯方向：${result.file}`,
          `方向（${result.counts.topics}）：${result.domain.topics.join('、') || '（空）'}`,
          `关键词（${result.counts.keywords}）：${result.domain.keywords.join('、') || '（空）'}`,
          result.counts.exclude === 0 ? undefined : `排除（${result.counts.exclude}）：${result.domain.exclude.join('、')}`,
          result.domain.scoringNotes === undefined ? undefined : `口径：${result.domain.scoringNotes}`,
          '可以先用 study_feeds_refresh 抓一轮、再 study_feeds_search 看看这份方向筛出来的东西对不对；不合适就再调一次覆盖。',
        );
      },
    },
    isConcurrencySafe: () => false,
    async execute(args: unknown) {
      const workspaceDir = workspaceOf(args, config);
      const result = saveNewsDomain(workspaceDir, {
        topics: readArray(args, 'topics'),
        keywords: readArray(args, 'keywords'),
        exclude: readArray(args, 'exclude'),
        scoringNotes: readString(args, 'scoringNotes'),
      });
      return { file: result.file, counts: result.counts, domain: result.domain, workspaceDir };
    },
  });
}

/** 资讯相关的 5 个工具：AIHOT（路线 A）+ 内置信源（路线 B）+ 方向重写。 */
export function registerNewsTools(ctx: PluginContext, config: ToolsConfig): void {
  registerNewsTool(ctx, config);
  registerRefreshTool(ctx, config);
  registerSearchTool(ctx, config);
  registerSourcesTool(ctx);
  registerDomainTool(ctx, config);
}

export type { AihotNewsItem };