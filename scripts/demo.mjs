#!/usr/bin/env node
/**
 * 一条命令看全五个模块 —— 也是「v0.1.0 真的能跑」的现场证据。
 *
 *   node scripts/demo.mjs              # 用内置样例 PDF，离线模块全跑
 *   node scripts/demo.mjs --online     # 额外跑一次热点雷达与 GEO 检索（需要网络）
 *   node scripts/demo.mjs --pdf x.pdf  # 换成你自己的 PDF
 *
 * 依赖仓库已 build（pnpm build）。
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = join(root, '.demo');
mkdirSync(demoDir, { recursive: true });

/** Windows 上动态 import 绝对路径必须走 file:// URL。 */
const load = (relative) => import(pathToFileURL(join(root, relative)).href);

const scholar = await load('packages/scholar/dist/index.js');
const carsi = await load('packages/carsi-router/dist/index.js');
const career = await load('packages/career/dist/index.js');

const args = process.argv.slice(2);
const online = args.includes('--online');
const pdfArg = args.indexOf('--pdf');
const pdfPath = pdfArg >= 0 ? resolve(args[pdfArg + 1]) : join(demoDir, 'demo-notes.pdf');

const line = (title) => console.log(`\n=== ${title} ===`);

// 1. scholar：索引一份 PDF，再带页码检索
line('scholar · 建索引 + 带页码检索');
if (pdfArg < 0) writeFileSync(pdfPath, samplePdf());
const indexPath = join(demoDir, 'demo-index.db');
// 每次演示都从空库开始，否则会看到上一次的旧命中。
for (const suffix of ['', '-wal', '-shm']) rmSync(`${indexPath}${suffix}`, { force: true });
const store = new scholar.ScholarStore(indexPath);
try {
  const indexed = await scholar.indexPdfFile(store, { filePath: pdfPath, docKey: 'demo', meta: { title: '演示讲义' } });
  console.log(`索引：${indexed.pages} 页 → ${indexPath}`);
  // 内置样例 PDF 只有 ASCII（简易 Type1 字体嵌不了中文），中文检索请用 --pdf 指向你自己的中文 PDF。
  const queries = pdfArg < 0 ? ['rehabilitation robotics', 'genomic', 'lung cancer'] : ['基因组', '康复机器人', 'lung cancer'];
  for (const query of queries) {
    const hits = store.search(query, { limit: 3 });
    console.log(`检索「${query}」：${hits.length} 条` + (hits.length === 0 ? '' : ` → 第 ${hits.map((hit) => hit.page).join('、')} 页`));
    if (hits[0] !== undefined) console.log(`  ${hits[0].snippet.slice(0, 80)}`);
  }
  console.log(`库统计：${store.stats().chunks} 个块 / ${store.stats().documents} 篇`);
} finally {
  store.close();
}

// 2. carsi-router：资源画像 + 检索式（离线）
line('carsi-router · 资源画像 + 检索式');
const summary = carsi.catalogSummary();
console.log(`资源 ${summary.total} 条：校购 ${summary.byAccess['subscription'] ?? 0} / 免费 ${summary.byAccess['free'] ?? 0} / 试用 ${summary.byAccess['trial'] ?? 0}`);
const recommended = carsi.recommendResources('literature-zh').slice(0, 2);
for (const resource of recommended) console.log(`- ${resource.name}（${resource.provider}）`);
console.log(carsi.buildSearchFormula({ database: 'pubmed', keywords: ['脑卒中', '深度学习'], fromYear: 2020, types: ['review'] }).formula);

// 3. career：测评 → 匹配 → 差距 → 四年计划（离线）
line('career · RIASEC → 岗位匹配 → 四年计划');
const answers = Object.fromEntries(career.RIASEC_ITEMS.map((item) => [item.id, item.dimension === 'I' || item.dimension === 'C' ? 5 : 2]));
const profile = career.scoreRiasec(answers);
console.log(career.describeProfile(profile));
const [match] = career.matchOccupations(profile, career.OCCUPATIONS, { limit: 3 });
console.log(`最匹配：${match.occupation.title}（${match.score.toFixed(1)} 分）`);
const gaps = career.findSkillGaps(match.occupation, [{ skill: 'Python 编程', level: 2 }, { skill: '统计分析', level: 1 }], { maxGaps: 3 });
console.log(career.summarizeGaps(gaps));
const plan = career.buildFourYearPlan({
  goal: { degree: '考研', direction: match.occupation.field, occupationId: match.occupation.id, startYear: 2026 },
  occupation: match.occupation,
  currentSkills: [{ skill: 'Python 编程', level: 2 }],
});
for (const year of plan.years) console.log(`- ${year.label}：${year.objectives.slice(0, 2).join('；')}`);

// 4/5. paper-radar + bio-data：只在 --online 时跑（需要网络）
if (online) {
  const radar = await load('packages/paper-radar/dist/index.js');
  const bio = await load('packages/bio-data/dist/index.js');
  line('paper-radar · 最近 3 天热点（网络）');
  const feedResult = await radar.collectRadar({ days: 3, perSource: 3, limit: 3 });
  console.log(`抓到 ${feedResult.items.length} 篇；来源 ${JSON.stringify(feedResult.perSource)}`);
  for (const warning of feedResult.warnings) console.log(`注意：${warning}`);
  for (const item of feedResult.items.slice(0, 3)) console.log(`- [${item.source}] ${item.title.slice(0, 60)}`);
  console.log(`AIHOT 信源键：${Object.keys(radar.aihotSourceConfig('https://example.com/r.json')).join(', ')}`);

  line('bio-data · GEO 检索（网络）');
  const geo = await bio.searchGeo({ term: 'single-cell lung cancer', maxResults: 2, fetch: globalThis.fetch });
  console.log(`命中共 ${geo.count} 条，取 ${geo.items.length} 条`);
  for (const dataset of geo.items) console.log(`- ${dataset.accession}｜${dataset.title.slice(0, 50)}｜${dataset.organism}｜${dataset.samples} 样本`);
  for (const link of bio.cngbDeepLinks('单细胞 肺癌')) console.log(`- ${link.name}：${link.url}`);
} else {
  line('paper-radar / bio-data');
  console.log('跳过联网模块（加 --online 才会跑；arXiv 在部分校园网不可达，只会变成一条 warning）。');
}

console.log('\n全部模块跑完。');

/** 造一份 2 页、只有 ASCII 的最小 PDF（不引第三方库，也不依赖测试夹具）。 */
function samplePdf() {
  const pages = [
    'Rehabilitation robotics helps stroke survivors recover.',
    'Genomic analysis of lung cancer cohorts needs careful design.',
  ];
  const objects = [];
  const contentIds = [];
  let id = 4;
  const pageIds = [];
  for (const text of pages) {
    pageIds.push(id++);
    contentIds.push(id++);
  }
  const kids = pageIds.map((pageId) => `${pageId} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((text, index) => {
    const contentId = contentIds[index];
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = `BT /F1 14 Tf 72 720 Td (${text.replace(/[()\\]/g, (char) => `\\${char}`)}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}