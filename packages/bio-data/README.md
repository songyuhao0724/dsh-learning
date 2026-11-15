# @dsh-learning/bio-data

科研数据检索：把「我要找某类公共测序数据」这件事，从「打开五六个网站、记五种编号规则」，变成一次带元数据的检索。

## 支持什么

| 平台 | 能力 | 说明 |
| --- | --- | --- |
| NCBI **GEO**（`gds` 库） | 检索 GSE 数据集，返回标题/摘要/物种/研究类型/样本数/平台/PubMed/更新日期/FTP | 走 E-utilities `esearch` + `esummary`，无需 key |
| NCBI **SRA**（`sra` 库） | 检索 SRP 研究，返回标题/物种/Run 数 | SRA 的 esummary 只回一个 `expxml` 字符串，这里按标签拆成结构化字段 |
| **CNGBdb / CNSA / GSA** | 带关键词的门户深链 | 只有网页门户、检索接口要申请 → **不抓页面**，只给跳转链接 |

## 用法

```ts
import { searchGeo, searchSra, cngbDeepLinks } from '@dsh-learning/bio-data';

const geo = await searchGeo({ term: 'single-cell lung cancer AND "Homo sapiens"[Organism]', maxResults: 5, fetch });
// geo.count 是服务端总命中；geo.items 是解析后的数据集；geo.warnings 说明跳过了几条非数据集命中

const sra = await searchSra({ term: 'single-cell lung cancer', maxResults: 5, fetch });
const links = cngbDeepLinks('肺癌 单细胞');   // 三个国内平台各自带着关键词的深链
```

`fetch` 必须显式传入（默认不绑定全局 `fetch`，方便测试注入假实现；在 DSH 工具层由插件传 `globalThis.fetch`）。

## 为什么只给国内平台深链

CNGBdb 的检索页要登录态、接口要申请授权，页面上也没有稳定的结构化标记。**抓取一个需要登录的科学数据库**既不合法也不稳定；相比之下，给一个能直接点过去、带着已编码关键词的深链，用户点两下就能到结果页——这是这件事上「正确的偷懒」。

## 设计取舍

- **只认 GSE 编号的条目**：`gds` 库里同时混着平台（GPL）和样本级命中，不筛掉会让「检索数据集」的结果列表失真。
- **不解析 SRA 的原始 XML 结构树**：只要能拿到 SRP 编号、标题、物种、Run 数就够导航了；再深一层要 join 十几张表，收益远小于成本。
- **命中数过万时提醒收窄**：SRA 上 `single cell` 有近 5 万条命中，直接把前 10 条当结果是误导用户，所以显式提示「共命中 N 条」。`