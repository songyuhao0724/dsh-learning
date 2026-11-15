# @dsh-learning/paper-radar

热点论文雷达：从 **arXiv / bioRxiv / medRxiv / PubMed** 抓近期论文，按主题打标，再导出成 **AIHOT** 能直接吃下的 `json_list` JSON 信源。

它解决的是一个具体问题：研究生和科研岗的同学不可能每天刷四个预印本网站，但热点又是「早看到一天就有价值」的东西。这个包把「抓取 → 打标 → 去重 → 排序 → 标准化」做掉，剩下的投放交给 AIHOT 这类成熟的热点站。

## 用法

```bash
# 看内置主题
node packages/paper-radar/dist/cli.js topics

# 终端里先看一眼
node packages/paper-radar/dist/cli.js preview --days 3 --per-source 5

# 导出一份 AIHOT 信源文件（同时打印对应的采集配置）
node packages/paper-radar/dist/cli.js export --out radar.json --days 7 --topics medical-ai,genomics

# 只打印 AIHOT 的采集配置
node packages/paper-radar/dist/cli.js export --out radar.json --source-config
```

作为库使用：

```ts
import { collectRadar, toAiHotFeed, aihotSourceConfig } from '@dsh-learning/paper-radar';

const result = await collectRadar({ days: 7, perSource: 25, topics: ['medical-ai'] });
const feed = toAiHotFeed(result.items);      // { data: { items: [...] } }
const config = aihotSourceConfig('https://example.com/radar.json');
```

## 数据源

| 源 | 接口 | 需要 key | 备注 |
| --- | --- | --- | --- |
| arXiv | `export.arxiv.org/api/query` (Atom) | 否 | 抓 `q-bio.*` 与 `cs.LG` 交叉，最多 2 秒一次 |
| bioRxiv / medRxiv | `api.biorxiv.org/details/<server>/<from>/<to>/<cursor>` | 否 | 官方推荐按日期区间拉，一次最多 100 条 |
| PubMed | E-utilities `esearch` + `esummary` | 否（建议带 `tool`/`email`） | 只有给了 `--query` 才查，避免把全库噪音拉进来 |

**没有做的事**：不爬订阅库、不绕付费墙、不抓全文。这里只有公开的标题/摘要/元数据 + 原文链接。

## 主题

内置 8 个主题（`medical-ai`、`genomics`、`bioinfo-method`、`precision-medicine`、`neuro`、`public-health`、`clinical-trial`、`rehab`），每个主题是一组中英混合正则。命中多个主题的论文会同时带上多个标签——这是刻意的：一篇「用深度学习做基因组变异检测」的论文，同时属于 `medical-ai` 和 `genomics`。

要加主题，改 `src/topics.ts` 的 `TOPICS` 即可，`resolveTopics` 认得 id 也认得中文标签。

## AIHOT 对接

`aihotSourceConfig(url)` 只产出 **AIHOT 文档里出现过的键**（`url` / `mode` / `itemsPath` / `titlePaths` / `summaryPaths` / `urlTemplate` / `publishedAtPath` / `externalIdPath` / `authorPaths`）。AIHOT 收到不认识的配置项会直接拒绝这条信源，所以这个白名单是刻意收紧的：

1. 把 `export --out` 生成的 JSON 放到任意静态地址（本地文件服务器、GitHub Pages、对象存储都行）；
2. 在 AIHOT 里新增信源，类型选 `json_list`，`mode` 选 `json_api`；
3. 把打印出来的配置粘进去，`externalIdPath: "id"` 保证重复抓取不会产生重复条目。

时间一律输出 **带时区偏移的 ISO 8601**（`published_at`），因为 AIHOT 的 `publishedAtUnit` 默认按本地时间猜，带偏移最不容易错。

## 设计取舍

- **arXiv 常抓，PubMed 按需**：arXiv 有稳定 Atom feed、限速明确；PubMed 的排序与主题匹配太宽，无条件查会把「最近 7 天所有论文」都拉进来。
- **先 DOI 去重再 id 去重**：同一篇论文常常 bioRxiv 先挂、两周后进 PubMed，DOI 是唯一可靠的重合点；同 DOI 时保留摘要更长的（bioRxiv 摘要通常更完整）。
- **失败只记 warning**：单个源挂了不该让整轮结果变空——科研同学更想要「三个源的结果 + 一句哪个源挂了」，而不是一个红叉。