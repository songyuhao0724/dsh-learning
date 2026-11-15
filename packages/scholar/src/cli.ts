#!/usr/bin/env node
/**
 * dsh-scholar：把 Zotero 文献库变成可检索、可引用问答的本地索引。
 *
 * 用法：
 *   dsh-scholar summary --db <zotero.sqlite> --data <Zotero data dir>
 *   dsh-scholar index   --db <zotero.sqlite> --data <Zotero data dir> --index <index.db>
 *   dsh-scholar search  --index <index.db> --query "卷积神经网络" [--limit 5] [--json]
 *
 * 全部在本机完成，不发任何网络请求。
 */
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { importZoteroLibrary, indexPdfFile } from './import.js';
import { ScholarStore } from './store.js';
import { openZoteroDb, summarize } from './zotero.js';

interface Args {
  command: string;
  db?: string;
  data?: string;
  index?: string;
  query?: string;
  file?: string;
  title?: string;
  limit?: number;
  json: boolean;
}

const USAGE = `dsh-scholar —— 本地文献索引（Zotero 只读）

用法:
  dsh-scholar summary --db <zotero.sqlite> --data <Zotero data dir>
  dsh-scholar index   --db <zotero.sqlite> --data <Zotero data dir> --index <index.db> [--limit 500]
  dsh-scholar index-file --file <论文.pdf> --index <index.db> [--title "标题"]
  dsh-scholar search  --index <index.db> --query <文本> [--limit 5] [--json]

说明:
  * 只读 zotero.sqlite；Zotero 正在运行时自动读取副本，不会写用户库。
  * 只处理已经在本地 storage/ 里的 PDF，不下载、不解密、不绕访问控制。
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? 'help', json: false };
  for (let i = 1; i < argv.length; i++) {
    const flag = argv[i];
    const next = (): string => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`参数 ${flag} 缺少值`);
      i += 1;
      return value;
    };
    switch (flag) {
      case '--db':
        args.db = next();
        break;
      case '--data':
        args.data = next();
        break;
      case '--index':
        args.index = next();
        break;
      case '--query':
        args.query = next();
        break;
      case '--file':
        args.file = next();
        break;
      case '--title':
        args.title = next();
        break;
      case '--limit':
        args.limit = Number(next());
        break;
      case '--json':
        args.json = true;
        break;
      case '-h':
      case '--help':
        args.command = 'help';
        break;
      default:
        throw new Error(`未知参数：${flag}`);
    }
  }
  return args;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) throw new Error(`缺少必填参数 ${name}`);
  return value;
}

function requireFile(value: string | undefined, name: string): string {
  const path = requireArg(value, name);
  if (!existsSync(path)) throw new Error(`${name} 指向的文件不存在：${path}`);
  return path;
}

function formatAuthors(meta: Record<string, unknown>): string {
  const authors = Array.isArray(meta.authors) ? (meta.authors as string[]) : [];
  if (authors.length === 0) return '未知作者';
  return authors.length > 3 ? `${authors.slice(0, 3).join(', ')} 等` : authors.join(', ');
}

async function runSummary(args: Args): Promise<void> {
  const dbPath = requireFile(args.db, '--db');
  const handle = openZoteroDb(dbPath);
  try {
    const summary = summarize(handle);
    if (args.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    console.log('Zotero 库概况');
    console.log(`  文献    ${summary.items}`);
    console.log(`  附件    ${summary.attachments}`);
    console.log(`  分类    ${summary.collections}${summary.collections > 0 ? '' : '（未使用分类）'}`);
    const types = Object.entries(summary.byType)
      .map(([name, count]) => `${name}×${count}`)
      .join('  ');
    console.log(`  类型    ${types || '—'}`);
    console.log(`  来源    ${handle.isCopy ? '库被占用，已读取副本' : '直接只读打开'}`);
    if (summary.items === 0) {
      console.log('\n提示：库里还没有文献。先用浏览器里的 Zotero Connector 抓几篇带 PDF 的论文，再回来建索引。');
    }
  } finally {
    handle.close();
  }
}

async function runIndex(args: Args): Promise<void> {
  const dbPath = requireFile(args.db, '--db');
  const dataDir = requireArg(args.data, '--data');
  const index = requireArg(args.index, '--index');
  const store = new ScholarStore(index);
  try {
    const result = await importZoteroLibrary({
      dbPath,
      dataDir,
      store,
      limit: args.limit ?? 500,
      onProgress: (event) => {
        if (args.json) return;
        const mark = event.status === 'indexed' ? '✓' : '·';
        const tail = event.status === 'indexed' ? '' : `（跳过：${event.status}）`;
        console.log(`${mark} [${event.index}/${event.total}] ${event.title}${tail}`);
      },
    });
    const stats = store.stats();
    if (args.json) {
      console.log(JSON.stringify({ ...result, stats, index }, null, 2));
      return;
    }
    console.log('');
    console.log(`完成：${result.documents} 篇文献 / ${result.pages} 页进入索引，共 ${stats.chunks} 块。`);
    if (result.skipped.length > 0) {
      console.log(`跳过 ${result.skipped.length} 篇：`);
      for (const item of result.skipped) {
        console.log(`  - ${item.title}（${item.reason}${item.detail ? `：${item.detail}` : ''}）`);
      }
    }
    console.log(`索引文件：${index}`);
  } finally {
    store.close();
  }
}

async function runIndexFile(args: Args): Promise<void> {
  const file = requireFile(args.file, '--file');
  const index = requireArg(args.index, '--index');
  const store = new ScholarStore(index);
  try {
    const result = await indexPdfFile(store, {
      filePath: file,
      docKey: file,
      meta: { title: args.title ?? basename(file), source: 'file' },
    });
    if (args.json) {
      console.log(JSON.stringify({ ...result, stats: store.stats() }, null, 2));
      return;
    }
    console.log(`已索引：${args.title ?? basename(file)}（${result.pages} 页）→ ${index}`);
    console.log(`库内共 ${store.stats().documents} 篇 / ${store.stats().chunks} 块。`);
  } finally {
    store.close();
  }
}

function runSearch(args: Args): void {
  const index = requireFile(args.index, '--index');
  const query = requireArg(args.query, '--query');
  const store = new ScholarStore(index);
  try {
    const hits = store.search(query, { limit: args.limit ?? 5 });
    if (args.json) {
      console.log(JSON.stringify(hits, null, 2));
      return;
    }
    if (hits.length === 0) {
      console.log(`没有命中「${query}」。换更短的关键词，或先跑 index 建索引。`);
      return;
    }
    console.log(`命中 ${hits.length} 处：「${query}」`);
    hits.forEach((hit, i) => {
      const title = String(hit.meta.title ?? hit.docKey);
      console.log('');
      console.log(`[${i + 1}] ${title} · 第 ${hit.page} 页`);
      console.log(`    作者：${formatAuthors(hit.meta)}`);
      console.log(`    摘录：${hit.snippet}`);
    });
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  try {
    switch (args.command) {
      case 'summary':
        await runSummary(args);
        break;
      case 'index':
        await runIndex(args);
        break;
      case 'index-file':
        await runIndexFile(args);
        break;
      case 'search':
        runSearch(args);
        break;
      default:
        console.log(USAGE);
    }
  } catch (error) {
    console.error(`出错：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

await main();