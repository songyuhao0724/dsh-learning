# @dsh-learning/carsi-router

回答三个学生每天都会问、但没人给标准答案的问题：

1. **「这篇文献我怎么才能看到全文？」** —— 给定 DOI / PMID / 题名，判定开放获取状态，给出可合法打开的链接；拿不到就告诉你该去学校哪个库里查。
2. **「学校到底买了哪些库？」** —— 内置一份可复核的 CARSI 资源目录（按「我要做什么」推荐，而不是按字母表罗列）。
3. **「为什么我在 PubMed/知网里搜不到？」** —— 把关键词翻译成能直接粘贴的检索式。

## 它不做什么

这一条比功能列表更重要：

- **不抓全文、不爬订阅库、不存 cookie、不绕验证码、不绕付费墙。**
- 不代用户登录 CARSI。身份验证永远发生在用户自己的浏览器里。
- 不承诺「免费」。资源目录里的 `access` 字段依据门户标签记录，各校采购与试用周期不同，以门户实时状态为准。

只提供**元数据与入口**：OpenAlex / Unpaywall / Europe PMC 都是公开免费的 OA 元数据服务。

## 用法

```ts
import { planAccess, buildSearchFormula, recommendResources } from '@dsh-learning/carsi-router';

// 1) 这篇论文现在怎么拿到？
const plan = await planAccess(
  { doi: '10.1038/s41586-020-2649-2', keywords: ['基因组', '序列比对'] },
  { email: 'you@example.com' }, // Unpaywall 必填；OpenAlex 用它进 polite pool
);
plan.best;        // 首选打开方式（OA 优先）
plan.routes;      // 所有可选路由，按「不需要订阅」排前面
plan.warnings;    // 哪一路失败了、为什么（如实告诉用户）
plan.suggestions; // 没有 OA 时：去 CARSI 目录里的哪几个库查

// 2) 检索式怎么拼？
buildSearchFormula({
  database: 'pubmed', // 'pubmed' | 'cnki' | 'wos' | 'europepmc'
  keywords: ['脑卒中', '康复'],
  synonymGroups: [['stroke', 'cerebrovascular accident']],
  fromYear: 2020,
  toYear: 2025,
  types: ['review'],
}).formula;
// => ("脑卒中"[Title/Abstract] OR "康复"[Title/Abstract])
//    AND (2020/01/01[Date - Publication] : 2025/12/31[Date - Publication])
//    AND (review[pt])

// 3) 我现在要做文献综述，先开哪几个库？
recommendResources('literature-en');
```

## 可得性判定的数据源

| 数据源 | 用途 | 注意 |
| --- | --- | --- |
| [Unpaywall](https://unpaywall.org/) | 最权威的 OA 判定与合法副本链接 | **必须带 `email`**，否则 422 |
| [OpenAlex](https://openalex.org/) | DOI / 题名检索，OA 状态与各版本链接 | 免 key；带 `mailto` 进 polite pool |
| [Europe PMC](https://europepmc.org/) | DOI / PMID 反查，全文链接清单 | 未命中返回 `hitCount: 0`（HTTP 200 而非 404） |

任何一路失败都只进 `warnings`，不影响其它路 —— 校园网出口经常半通不通，这一点必须容错。

## 资源目录怎么维护

内置目录在 `src/data/carsi-resources.ts`，目前 17 条**可逐条复核**的条目，来自 CARSI 应用资源门户（康复大学身份下 96 条：校购 16 / 免费 14 / 试用 55 / 混合 13）。

收录原则：

1. **不猜 URL。** 拿不到官方入口就留空，让用户从门户点进去。
2. **不写会过期的话术。** 「试用即将到期」这类信息不写进代码。
3. 新增条目请在 PR 描述里给出处（门户截图或官方页面链接），并把 `verified` 设为 `true`。

试用期资源**故意不收**：试用一结束链接必然失效，内置进去只会让用户点开 404。

## License

Apache-2.0。资源名称与商标归各自权利人所有，本包与各数据库厂商无隶属关系。