# 架构

## 1. 为什么是「插件集合」而不是「一个独立应用」

市面上大量「大学生 AI 助手」是一个独立 Web 应用：登录、上传、云端存储。它们的问题是：

- 你的论文、你的成绩、你的规划，全部存在别人的服务器上；
- 它无法操作你本机的文件（排版 PPT、改 Word 格式、整理文件夹）；
- 它的模型是固定的，你换不了。

DSH（DeepSeek Harness）提供的是一个**本地 agent 运行时**：模型可选、文件可读写、命令可执行、还能挂子智能体。把能力做成 DSH 插件，等于：

| 维度 | 独立 Web 应用 | 本项目（DSH 插件） |
|---|---|---|
| 数据位置 | 云端 | 你本机 |
| 模型 | 平台指定 | 你自己选 |
| 文件能力 | 上传下载 | 直接读写本机 |
| 隐私 | 取决于平台 | 不联网也能用（除显式调用的公开 API） |
| 成本 | 订阅制 | 你的模型额度 |

## 2. 包拓扑

```
            ┌─────────────────────────────┐
            │  preset-zhihang (agent 预设) │
            │  persona「知航」+ 标准工具集   │
            └──────────────┬──────────────┘
                           │ 预设里 insert 的插件行
     ┌──────────┬──────────┼──────────┬──────────┐
     ▼          ▼          ▼          ▼          ▼
  scholar  carsi-router  career  paper-radar  bio-data
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
  Zotero    CARSI 清单   O*NET/     arXiv/    NCBI
  本地库    + OA 元数据   ESCO       bioRxiv   E-utils
     │          │          │          │          │
     └──────────┴──────────┴────┬─────┴──────────┘
                                ▼
                        共享：ctx.services
                        （profile 目录、fs、子进程、日志）

  onboarding（档案 + 资讯口径）与 feeds（27 个免费 RSS/Atom 源）
  是两条旁路：onboarding 只写工作区里的 JSON，feeds 只写
  学习档案/资讯.db，都不依赖网络之外的任何服务。
```

**关键约束**：每个功能包都是独立的 Cordis 插件，可以单独启用/禁用/卸载。预设只是把它们「装配」到一起。这样用户可以只要 scholar 不要 career。

## 3. 数据流

### 3.1 scholar（文献）

```
Zotero 写入 zotero.sqlite + storage/<KEY>/xxx.pdf
        │  （用户用 Zotero Connector 单篇抓取，浏览器内完成）
        ▼
[dsh-learning/scholar]
  1. 复制 DB 到临时目录（避免锁库）
  2. 查询 items + itemAttachments → 得到 (itemID, title, DOI, pdfPath)
  3. pdfjs-dist 抽取文本 → 按页切块
  4. Intl.Segmenter('zh') 分词 → SQLite FTS5 建索引
  5. 监听 storage mtime → 增量更新
        │
        ▼
  问答时：FTS5 召回 top-k 段落 → 带 (文档标题, 页码) 交给模型 → 回答必须标注出处
```

**为什么 FTS5 而不是向量库**：中文场景下，`Intl.Segmenter` + FTS5 已经能覆盖 80% 的「找那句话」需求，零依赖、零编译、索引小、可增量。向量检索作为可选增强层（需要 embedding 端点），不做默认。

### 3.2 carsi-router（能不能看）

```
输入：DOI 或标题
  ▼
Crossref/OpenAlex 取元数据 → 得到期刊、年份、ISSN
  ▼
Unpaywall/Europe PMC 查 OA 状态 → 有合法 OA 版本？→ 给 OA 链接
  ▼ 否则
匹配内置资源画像（`packages/carsi-router/src/data/carsi-resources.ts`，25 条：我校买了哪些库、每条要不要登录、入口在哪）
  ▼
输出：{ 可得性: oa | subscribed | trial | unavailable,
        入口: <数据库深链>, 说明: "Springer 校购覆盖 1997-至今" }
```

**注意**：这里只做「判断 + 给链接」，不代用户发起任何需要身份认证的请求。

### 3.3 career（职业）

```
霍兰德测评（自编题目，RIASEC 六维打分）
  + 个人档案（专业、年级、目标、短板）
  + O*NET/ESCO 职业画像（技能、任务、所需教育）
  ▼
职业方向候选（3 个，带匹配理由与差距清单）
  ▼
四年路线（每年：技能时间线 + 优势 + 短板 + 年度目标）
  ▼
导出 Word（复用 python-docx / 或 Node 侧 docx 生成）
```

### 3.4 paper-radar（热点）

```
手动/定时触发 collectRadar()
  ▼
并发抓三个源（Promise.allSettled，单源失败只记 warning）
  - arXiv：export.arxiv.org/api/query（Atom，q-bio.QM / q-bio.GN / q-bio.NC / cs.LG）
  - bioRxiv / medRxiv：api.biorxiv.org/details/<server>/<from>/<to>/<cursor>
  - PubMed：仅当给了 query 才查（esearch → esummary），避免全库噪音
  ▼
主题打标：8 个内置主题（中英混合正则），一篇可同时带多个标签
  ▼
去重：先按 DOI（同 DOI 保留摘要更长的），再按 id；按 publishedAt 倒序
  ▼
输出 { data: { items: [{ id, title, summary, url, published_at, tags, authors, doi? }] } }
  ▼
用户自己的 AIHOT 实例以 json_list 信源接入（零代码改 AIHOT）
```

**为什么 PubMed 要按需**：arXiv 有稳定 Atom feed、限速明确；PubMed 的默认排序与主题匹配太宽，无条件查会把「最近 7 天所有论文」拉进来。

### 3.5 bio-data（科研数据）

```
study_bio_data_search(source, term)
  ├─ geo  → esearch(db=gds) → esummary → 只保留 GSE 级条目 → GeoDataset[]
  ├─ sra  → esearch(db=sra) → esummary → 解析 expxml 字符串 → SraStudy[]
  └─ cngbdb → 不抓页面，只生成带 encodeURIComponent(term) 的门户深链
```

SRA 的 `esummary` 只返回一个 `expxml` 字符串（`<Study acc="SRP…"/><Organism ScientificName="…"/><Runs><Run …/>`），没有结构化字段，所以按标签取 accession / 标题 / 物种 / Run 数。CNGBdb / CNSA / GSA 的检索接口要申请授权、页面要登录态，**抓取不稳定也不合规**，所以只给深链。

### 3.6 onboarding（知航怎么「先认识你」）

```
            ┌──────────── 每次新会话，回答第一句之前 ────────────┐
用户工作区  │ study_profile_status → 完成度 / nextQuestions       │
学习档案/   │ study_resource_check → ok|warn|missing + 怎么补      │
个人档案.json│ 必填没齐：nextQuestions[0] 一次一个问题，答即存      │
个人档案.md  │ 有 nextDeadline：一行提醒                          │
初始化向导.html│ 用户说不会填：study_profile_wizard 出引导页        │
            └──────────────────────────────────────────────────┘
```

三个刻意的设计：

1. **档案是数据，不是散文。** 25 个字段 / 5 组带 `required` 标记，所以「还差什么」是算出来的（`profileStatus()`），不是让模型回忆。这也是为什么引导页的进度条可信。
2. **主动有边界。** 开场最多 5 行、一次只问一个问题、同一天不重复同一句提醒——「主动」不等于刷屏。提醒的触发条件全部来自档案字段（`nextDeadline` / 资源 `missing`），而不是模型心情。
3. **写回是硬规则。** 用户说的长期信息必须 `study_profile_save` 落盘；否则下一轮又得重新问，个性化就归零。里程碑由工具合并保留，不会因为重写档案而丢历史。

### 3.7 feeds（外国免费资讯）

```
study_news(baseUrl?)            ── AIHOT 在线时优先：/api/v1/items → 精选/翻译现成
        │ 连不上（ECONNREFUSED / HTTP 4xx·5xx / 非 JSON）
        ▼
study_feeds_refresh(sources|group) ── 27 个内置源，串行抓取（不并发打站点）
        │  GET（浏览器 UA + 15s 超时）→ detectFormat → parseFeed
        ▼
FeedStore.upsertMany(items)     ── INSERT … ON CONFLICT(id) DO NOTHING
        │  （重抓只更新正文，added 只算新 id；同文档重复 id 丢弃）
        ▼
学习档案/资讯.db（node:sqlite，表 feed_items + published/source 索引）
        │
        ▼
study_feeds_search(query?, since?, sourceIds?, topics?, domainOnly?)
        │  先 SQL 过滤（时间窗 / 源 / 主题 / 关键词 LIKE），再
        ▼  rankByDomain(items, 资讯方向.json)：标题 +3、主题 +2、摘要 +1、命中排除词归零
   [{title, url, source, publishedAt, domainScore, domainHits}]
```

四个刻意的设计：

1. **没有 AIHOT 也能用。** `study_news` 只是「省一次 LLM 调用」的快路径；抓取、入库、检索、方向加权全部本地完成，不依赖 Docker、不依赖任何外部服务。
2. **id 必须稳定。** 很多源不给 `guid`，如果拿「抓到的顺序」当 id，每次重抓都会重复入库。所以 `id = guid || link || FNV1a(源 id + 标题)`，同一篇永远同一个 id。
3. **方向是文件，不是提示词片段。** `资讯方向.json` 让「按专业重写」变成一次写盘而不是每轮现编关键词；`domainOnly` 检索完全离线，可复现、可手改。
4. **失败要如实说。** 单源失败只记在该源的 `error` 里（`HTTP 403` / 不是 RSS/Atom / 超时），不影响其他源，也不编造条目。

## 4. 存储

| 内容 | 位置 | 说明 |
|---|---|---|
| 索引库 | `<profile 数据目录>/dsh-learning/scholar.db` | FTS5，可删可重建 |
| 个人档案 | 用户工作区 `学习档案/个人档案.json`（+ `.md` 镜像、`初始化向导.html`） | 结构化，工具读写；用户也可手改 |
| 资讯方向 | 用户工作区 `学习档案/资讯方向.json` | 主题/关键词/排除词/评分备注，模型写、用户可手改 |
| 资讯库 | 用户工作区 `学习档案/资讯.db` | `node:sqlite` 一张 `feed_items` 表；可删可重建，删了重抓即恢复 |
| 引导页草稿 | 浏览器 `localStorage: zhihang-profile-draft-v1` | 只在用户机器上，不上传 |
| 资源画像 | 仓库 `packages/carsi-router/src/data/carsi-resources.ts`（25 条，按我校订购清单核对） | 学校买的库因人而异 |
| 缓存 | `os.tmpdir()/dsh-learning/` | 元数据缓存，带 TTL |

## 5. 技术选型与理由

| 选择 | 理由 | 备选与否决原因 |
|---|---|---|
| TypeScript + Cordis 插件 | DSH 原生形态，可直接跑在进程里 | 独立服务：多一个进程、多一套部署 |
| 重叠二元组 + FTS5 短语匹配 | `unicode61` 不切中文（实测 0 命中），`Intl.Segmenter('zh')` 把「卷积」切成「卷\|积」 | 引入 jieba：原生编译地狱；纯 `Intl.Segmenter`：中文词边界不可靠 |
| `node:sqlite`（含 FTS5） | Node 内置，零原生依赖，SQLite 3.53 自带 FTS5 | `better-sqlite3`：要为三平台编译 |
| `unpdf@1.9.x` | pdfjs 的零依赖封装，支持 Node 22 | `unpdf@2`：要求 Node ≥24，与 CI 矩阵冲突；`pdf-parse`：维护弱 |
| 手写 JSON Schema 工具定义 | `ToolSchema.parameters` 本就是 `Record<string, unknown>`，且不能 import `@deepseek-ai/*` | `defineTool`：需要从 app.asar 才能解析到 |
| 手写 RSS/Atom 解析（正则切条） | 只需 `title/link/guid/pubDate/summary` 五个字段，RSS 2.0 与 Atom 两种格式几十行就够 | `fast-xml-parser`：为五个字段引一个解析器，还要处理命名空间；`feedparser`：多年未维护 |
| 资讯检索用 `LIKE` 而不是 FTS5 | 资讯是「万级 + 强时间过滤」，`LIKE` 足够且零成本；FTS5 的中文二元组分词是 scholar 那种长文 PDF 场景的需要 | 复用 scholar 的 FTS5：多一套索引同步逻辑，收益不明显 |
| 不引入 ORM | 数据模型简单 | Prisma：太重 |

## 6. 里程碑与验收标准

每个里程碑的验收都不是「代码写完」，而是**能真实跑通**。

| 里程碑 | 验收标准（必须全部通过） |
|---|---|
| M1 | ① 在干净 profile 上 `install_bundle` 成功；② 预设下拉出现「知航」；③ 选中后能读写文件、能起子智能体；④ CI 绿 |
| M2 | ① 指向一个真实 Zotero 库能建索引；② 丢入新 PDF 后 30 秒内可检索；③ 提问返回的答案带**真实存在的**页码与原文片段（人工核对 3 条）；④ 不改动原库 |
| M3 | ① 输入 3 个 DOI，正确判断 OA/订阅/不可得；② 生成的 CNKI/WoS/PubMed 检索式能在对应库中直接粘贴执行；③ 资源画像覆盖 96 条 |
| M4 | ① 测评生成 RIASEC 六维分数；② 生成的四年路线含每年技能时间线与目标；③ 导出 Word 可正常打开、无乱码 |
| M5 | ① paper-radar 输出的 JSON 能被 AIHOT 作为 `json_list` 信源成功抓取；② bio-data 能按关键词返回 GEO 数据集元数据 | **已完成**：`dsh-radar export` 实测写出 `data.items`（含 `published_at` ISO 时间与 `urlTemplate: {raw:url}`）；`searchGeo({term:'single-cell lung cancer'})` 实测命中 10827 条、解析出 GSE349653（Homo sapiens，12 个样本）；14 个工具已装进 profile |
| M6 | ① 陌生人照 README 从零装通（录屏验证）；② COMPLIANCE 逐条自查；③ v0.1.0 tag |
| M8 | ① 全新工作区里 `study_feeds_refresh` 至少 3 个源成功入库、`study_feeds_search` 能按关键词命中；② `study_news_domain_save` 写盘后 `domainOnly` 检索的 `domainScore` 排序正确；③ `study_news` 在本机 AIHOT 在线时返回精选条目、离线时给出可执行的两条退路；④ `pnpm check` 全绿 | **已完成**：实测 27 源中 3/4 抽样源成功（PLOS/Nature Methods/Simon Willison 各 +5 条，bioRxiv 被 Cloudflare 拦并如实报错）；`study_news` 对本机 AIHOT 返回 3 条精选（含分数 77）；196 个测试全绿 |

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| DSH 插件 API 在版本间变动 | 锁 `peerDependencies` 到已测版本；CI 跑两档 Node；规格文档留档 |
| Zotero 数据库结构变动 | 只依赖核心表（items/itemAttachments/collections），并在启动时校验 `user_version` |
| 商业数据库条款变化 | 我们本来就只做导航，条款变化只影响画像数据，不影响代码 |
| 用户以为"能自动下全文" | README 与首次使用引导里明确写清边界 |
| 中文学术 PDF 排版复杂（双栏、公式） | v1 只承诺「能找到那句话」，不承诺完美还原公式 |
| 信源站点反爬（Cloudflare / UA 校验） | 逐源容错：失败只记该源 `error`，不中断整轮；README 明说哪些源可能拦，不假装成功 |
| 用户以为「内置资讯」= 有全文 | 只做标题 + 摘要 + 原文链接；全文仍走 CARSI / 开放获取路由 |