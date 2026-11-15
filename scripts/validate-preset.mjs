#!/usr/bin/env node
// 校验所有 preset bundle 的 cordis.patch.yml。
//
// 为什么需要这个脚本：Cordis 插件的 config 是在**运行期**校验的（很多插件在
// config 缺字段时直接 throw），装 bundle 那一步不会报错，等到用户真正选中预设
// 才炸。这个脚本把「必填 config」提前到 CI 里检查。
//
// 用法：node scripts/validate-preset.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(root, 'packages');

/** 已知的必填 config 字段。新增插件时在这里登记。 */
const REQUIRED_CONFIG = {
  '@deepseek-ai/dsh-persona': ['prefix'],
  '@deepseek-ai/dsh-plan-mode': ['section'],
  '@deepseek-ai/dsh-agent-preset': ['id', 'name', 'plugins'],
};

const files = fs.existsSync(packagesDir)
  ? fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(packagesDir, d.name, 'cordis.patch.yml'))
      .filter((p) => fs.existsSync(p))
  : [];

if (files.length === 0) {
  console.error('未找到任何 cordis.patch.yml —— packages/ 目录结构不对？');
  process.exit(1);
}

const problems = [];

/** 判断一个 config 值是否「有内容」。 */
function isPresent(key, value) {
  if (key === 'plugins') return Array.isArray(value) && value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return value !== undefined && value !== null;
}

for (const file of files) {
  const rel = path.relative(root, file);
  const raw = fs.readFileSync(file, 'utf8');
  // `!!js` 是 Cordis 的自定义标签，通用 YAML 解析器不认识它；
  // 去掉标签保留标量，既能解析又不影响结构校验。
  const cleaned = raw.replace(/!!js[ \t]+/g, '');

  let doc;
  try {
    doc = parse(cleaned);
  } catch (err) {
    problems.push(`${rel}: YAML 解析失败 —— ${err.message}`);
    continue;
  }

  if (!Array.isArray(doc)) {
    problems.push(`${rel}: 顶层应为数组（形如 "- insert: [...]"）`);
    continue;
  }

  const rows = doc.flatMap((entry) =>
    Array.isArray(entry?.insert) ? entry.insert : [],
  );
  if (rows.length === 0) {
    problems.push(`${rel}: 没有任何 insert 行`);
    continue;
  }

  const seenIds = new Set();
  for (const row of rows) {
    const rowId = row?.id;
    const name = row?.name;
    if (!rowId) {
      problems.push(`${rel}: 有 insert 行缺少 id`);
    } else if (seenIds.has(rowId)) {
      problems.push(`${rel}: insert 行 id 重复 —— ${rowId}`);
    } else {
      seenIds.add(rowId);
    }

    if (!name) {
      problems.push(`${rel}: 行 ${rowId ?? '(无 id)'} 缺少 name`);
      continue;
    }

    const required = REQUIRED_CONFIG[name];
    if (!required) continue;

    for (const key of required) {
      if (!isPresent(key, row?.config?.[key])) {
        problems.push(`${rel}: 行 ${rowId} (${name}) 缺少必填 config.${key}`);
      }
    }

    // 预设内部插件 id 不能重复
    if (Array.isArray(row?.config?.plugins)) {
      const innerIds = new Set();
      for (const plugin of row.config.plugins) {
        const pid = plugin?.id;
        if (!pid) {
          problems.push(`${rel}: 预设 ${rowId} 中有插件缺少 id`);
          continue;
        }
        if (innerIds.has(pid)) {
          problems.push(`${rel}: 预设 ${rowId} 插件 id 重复 —— ${pid}`);
        }
        innerIds.add(pid);
      }
    }
  }

  console.log(`✓ ${rel} —— ${rows.length} 行 insert，${seenIds.size} 个顶层 id`);
}

if (problems.length > 0) {
  console.error(`\n发现 ${problems.length} 个问题：`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log('\n全部通过。');