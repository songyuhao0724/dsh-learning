#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { collectRadar } from './radar.js';
import { TOPICS, topicLabel } from './topics.js';
import { aihotSourceConfig, toAiHotFeed } from './feed.js';
import type { RadarItem } from './types.js';

const USAGE = `dsh-radar —— 热点论文雷达

用法：
  dsh-radar topics                              列出内置主题
  dsh-radar export --out feed.json [选项]        抓一轮并导出 AIHOT json_list 文件
  dsh-radar preview [选项]                      抓一轮并在终端打印前几条

选项：
  --days <n>         往前看几天（默认 7）
  --per-source <n>   每个源最多抓几条（默认 25）
  --topics a,b       只要这些主题（id 或中文标签）
  --query <text>     主题检索词；给了才会查 PubMed
  --limit <n>        preview 打印几条（默认 10）
  --source-config    打印 AIHOT 信源采集配置 JSON 后退出
`;

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      days: { type: 'string' },
      'per-source': { type: 'string' },
      topics: { type: 'string' },
      query: { type: 'string' },
      limit: { type: 'string' },
      'source-config': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const command = positionals[0];
  if (command === undefined || values.help === true) {
    process.stdout.write(USAGE);
    return command === undefined && values.help !== true ? 2 : 0;
  }

  if (command === 'topics') {
    for (const topic of TOPICS) process.stdout.write(`- ${topic.id}：${topic.label}\n`);
    return 0;
  }

  if (values['source-config'] === true) {
    const url = values.out === undefined ? 'http://127.0.0.1:8787/radar.json' : values.out;
    process.stdout.write(`${JSON.stringify(aihotSourceConfig(url), null, 2)}\n`);
    return 0;
  }

  if (command !== 'export' && command !== 'preview') {
    process.stderr.write(`未知子命令：${command}\n\n${USAGE}`);
    return 2;
  }

  const days = values.days === undefined ? 7 : Number.parseInt(values.days, 10);
  const perSource = values['per-source'] === undefined ? 25 : Number.parseInt(values['per-source'], 10);
  const topics = values.topics === undefined ? undefined : values.topics.split(',').map((item) => item.trim()).filter((item) => item !== '');

  process.stderr.write(`抓取中（最近 ${days} 天，每源 ≤${perSource} 条）…\n`);
  const result = await collectRadar({
    days,
    perSource,
    ...(topics === undefined ? {} : { topics }),
    ...(values.query === undefined ? {} : { query: values.query }),
  });
  process.stderr.write(`来源条数：${Object.entries(result.perSource).map(([name, count]) => `${name} ${count}`).join('，')}；去重后 ${result.items.length} 条\n`);
  for (const warning of result.warnings) process.stderr.write(`注意：${warning}\n`);

  if (command === 'preview') {
    const limit = values.limit === undefined ? 10 : Number.parseInt(values.limit, 10);
    for (const item of result.items.slice(0, limit)) printItem(item);
    return 0;
  }

  if (values.out === undefined) {
    process.stderr.write('export 需要 --out <文件路径>\n');
    return 2;
  }
  const feed = toAiHotFeed(result.items);
  writeFileSync(values.out, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  process.stdout.write(`已写出 ${feed.data.items.length} 条到 ${values.out}\n`);
  process.stdout.write(`${JSON.stringify(aihotSourceConfig(values.out), null, 2)}\n`);
  return 0;
}

function printItem(item: RadarItem): void {
  const topics = item.topics.length === 0 ? '未分类' : item.topics.map((topic) => topicLabel(topic)).join('、');
  process.stdout.write(`\n[${item.source}] ${item.title}\n  ${item.publishedAt}｜${topics}\n  ${item.url}\n`);
  if (item.abstract !== '') process.stdout.write(`  ${item.abstract.slice(0, 160)}…\n`);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);