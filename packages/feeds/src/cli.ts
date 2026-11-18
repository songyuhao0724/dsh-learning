#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeDomain, rankByDomain } from './domain.js';
import { refreshFeeds } from './refresh.js';
import { FEED_GROUPS, FEED_SOURCES, resolveSources, sourceById } from './sources.js';
import { FeedStore } from './store.js';
import type { DomainProfile, StoredFeedItem } from './types.js';

/**
 * 命令行入口：给不想开会话、只想在终端里扫一眼的时候用。
 *   dsh-feeds sources
 *   dsh-feeds refresh --sources nature-methods,plos-compbiol
 *   dsh-feeds search "single cell" --limit 10 --domain 学习档案/资讯方向.json
 *   dsh-feeds stats
 */
const argv = process.argv.slice(2);
const command = argv[0] ?? 'help';
const FLAGS_WITH_VALUE = new Set(['db', 'sources', 'per-source', 'limit', 'since', 'domain', 'timeout']);

function flag(name: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  if (at === -1) return undefined;
  const value = argv[at + 1];
  return value !== undefined && !value.startsWith('--') ? value : '';
}

function positionals(): string[] {
  const out: string[] = [];
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token.startsWith('--')) {
      const bare = token.slice(2);
      if (FLAGS_WITH_VALUE.has(bare)) i += 1;
      continue;
    }
    out.push(token);
  }
  return out;
}

function dbPath(): string {
  const explicit = flag('db');
  if (explicit !== undefined && explicit !== '') return resolve(explicit);
  return resolve('学习档案', '资讯.db');
}

function loadDomain(): DomainProfile | undefined {
  const explicit = flag('domain');
  const path = explicit !== undefined && explicit !== '' ? resolve(explicit) : resolve('学习档案', '资讯方向.json');
  if (!existsSync(path)) return undefined;
  try {
    return normalizeDomain(JSON.parse(readFileSync(path, 'utf8')) as Partial<DomainProfile>);
  } catch {
    return undefined;
  }
}

function formatItem(item: StoredFeedItem, index: number): string {
  const source = sourceById(item.sourceId)?.name ?? item.sourceId;
  const date = (item.publishedAt ?? item.fetchedAt).slice(0, 10);
  const lines = [`${index + 1}. ${item.title}`, `   ${source} · ${date}${item.url === '' ? '' : ` · ${item.url}`}`];
  if (item.summary !== '') lines.push(`   ${item.summary.slice(0, 160)}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (command === 'sources' || command === 'list') {
    console.log(`共 ${FEED_SOURCES.length} 个信源（全部免费，无需学校订阅）\n`);
    for (const group of FEED_GROUPS) {
      const members = FEED_SOURCES.filter((source) => source.group === group);
      if (members.length === 0) continue;
      console.log(`${group}（${members.length}）`);
      for (const source of members) console.log(`  ${source.id.padEnd(20)} ${source.name}`);
      console.log('');
    }
    return;
  }

  if (command === 'refresh') {
    const store = new FeedStore(dbPath());
    try {
      const { picked, unknown } = resolveSources(flag('sources'));
      if (unknown.length > 0) console.error(`未知信源：${unknown.join(', ')}`);
      const perSourceRaw = Number(flag('per-source') ?? '30');
      const report = await refreshFeeds({
        store,
        fetch: (input, init) => fetch(input, init),
        sources: picked,
        perSource: Number.isFinite(perSourceRaw) && perSourceRaw > 0 ? perSourceRaw : 30,
      });
      for (const result of report.results) {
        const mark = result.ok ? '✓' : '✗';
        const detail = result.ok ? `+${result.added}（解析 ${result.seen}）` : (result.error ?? '失败');
        console.log(`${mark} ${result.name.padEnd(34)} ${detail}`);
      }
      const stats = store.stats();
      console.log(`\n新增 ${report.added} 条，失败 ${report.failed} 个源；库内共 ${stats.items} 条 / ${stats.sources} 个源`);
      console.log(`数据库：${store.file}`);
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'search' || command === 'query') {
    const words = positionals();
    if (words.length === 0) {
      console.error('用法：dsh-feeds search <关键词> [--limit 10] [--since 2026-11-01]');
      process.exitCode = 2;
      return;
    }
    const store = new FeedStore(dbPath());
    try {
      const limitRaw = Number(flag('limit') ?? '10');
      const items = store.search({
        query: words.join(' '),
        limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10,
        ...(flag('since') === undefined || flag('since') === '' ? {} : { since: flag('since') as string }),
      });
      const ranked = rankByDomain(items, loadDomain());
      if (ranked.length === 0) {
        console.log('没有命中；先跑一次 dsh-feeds refresh。');
        return;
      }
      console.log(`命中 ${ranked.length} 条：\n`);
      ranked.forEach((item, index) => {
        const badge = item.domainScore > 0 ? ` [方向 +${item.domainScore}]` : '';
        console.log(formatItem(item, index) + badge + '\n');
      });
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'stats') {
    const store = new FeedStore(dbPath());
    try {
      const stats = store.stats();
      console.log(`库内 ${stats.items} 条资讯，来自 ${stats.sources} 个源`);
      if (stats.earliest !== undefined) console.log(`最早：${stats.earliest.slice(0, 10)}`);
      if (stats.latest !== undefined) console.log(`最新：${stats.latest.slice(0, 10)}`);
      console.log(`数据库：${store.file}`);
    } finally {
      store.close();
    }
    return;
  }

  console.log(`知航 · 信源雷达（${FEED_SOURCES.length} 个免费信源）

用法：
  dsh-feeds sources                        列出信源
  dsh-feeds refresh [--sources a,b]        抓取并入库（默认全部）
  dsh-feeds search <关键词> [--limit 10]   检索库内资讯
  dsh-feeds stats                          看库的规模

可选参数：--db <路径>（默认 学习档案/资讯.db）、--domain <资讯方向.json>、--since <YYYY-MM-DD>、--per-source <n>`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});