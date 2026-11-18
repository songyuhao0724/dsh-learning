import { detectFormat, parseFeed } from './parse.js';
import { resolveSources } from './sources.js';
import type { FeedStore } from './store.js';
import type { FeedSource, FetchLike, RefreshReport, SourceResult } from './types.js';

/** 不少源会对空 UA / 爬虫 UA 返回 403，这里用一个中性的浏览器 UA。 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 zhihang-feeds/0.1';

export interface RefreshOptions {
  store: FeedStore;
  fetch: FetchLike;
  /** 只抓这些源；不给就抓全部 */
  sources?: FeedSource[] | string[];
  /** 每个源最多入库多少条（默认 30，按发布时间倒序） */
  perSource?: number;
  timeoutMs?: number;
  now?: Date;
  signal?: AbortSignal;
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`抓取超时（${timeoutMs} ms）`)), timeoutMs);
  const forward = (): void => controller.abort(signal?.reason);
  if (signal !== undefined) {
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

/** 把「调用方取消信号 + 超时」合成一个；给 HTTP 抓取与 AIHOT 接口共用。 */
export function withTimeoutSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; done: () => void } {
  return combineSignals(signal, timeoutMs);
}

/** 允许调用方传源对象或源 id；空数组表示「一个都不抓」。 */
function pickSources(sources: FeedSource[] | string[] | undefined): FeedSource[] {
  if (sources === undefined) return resolveSources().picked;
  if (sources.length === 0) return [];
  if (sources.every((item) => typeof item === 'string')) {
    return resolveSources(sources as string[]).picked;
  }
  return sources as FeedSource[];
}

/**
 * 串行抓取（不并发打满对方站点），逐源记录成功/失败。
 * 单个源失败不影响其它源——这一点对大陆网络很关键：总有源在某天抽风。
 */
export async function refreshFeeds(options: RefreshOptions): Promise<RefreshReport> {
  const startedAt = new Date().toISOString();
  const now = options.now ?? new Date();
  const perSource = options.perSource ?? 30;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const wanted = pickSources(options.sources);
  const results: SourceResult[] = [];

  for (const source of wanted) {
    const { signal, done } = combineSignals(options.signal, timeoutMs);
    try {
      const response = await options.fetch(source.url, {
        signal,
        headers: {
          'user-agent': DEFAULT_USER_AGENT,
          accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
          'accept-language': 'en;q=0.9',
        },
      });
      if (!response.ok) {
        results.push({ sourceId: source.id, name: source.name, ok: false, added: 0, seen: 0, error: `HTTP ${response.status}` });
        continue;
      }
      const body = await response.text();
      if (detectFormat(body) === 'unknown') {
        results.push({
          sourceId: source.id,
          name: source.name,
          ok: false,
          added: 0,
          seen: 0,
          error: '返回的不是 RSS/Atom（可能被站点拦截或该地址已失效）',
        });
        continue;
      }
      const items = parseFeed(body, source).slice(0, Math.max(1, perSource));
      const { added } = options.store.upsertMany(items, now.toISOString());
      results.push({ sourceId: source.id, name: source.name, ok: true, added, seen: items.length });
    } catch (error) {
      results.push({
        sourceId: source.id,
        name: source.name,
        ok: false,
        added: 0,
        seen: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      done();
    }
  }

  return {
    results,
    added: results.reduce((sum, result) => sum + result.added, 0),
    failed: results.filter((result) => !result.ok).length,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}