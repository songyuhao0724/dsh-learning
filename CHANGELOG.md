# 更新日志

本项目的所有重要变更都记录在这里。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-11-18

知航开始自己盯外国信源：内置 27 个免费 RSS/Atom 源 + 可写的「资讯方向」口径 + 5 个新工具；有 AIHOT 实例就读它的精选，没有也能独立跑。新增字段让初始化多问一句「要不要开资讯雷达」。

### 新增

- **新包 `@dsh-learning/feeds`**（零运行时依赖）：`FEED_SOURCES` 27 个源 / 6 个分组（期刊、预印本、厂商官方、研究机构、媒体、社区），全部免费公开、无需学校订阅；自写 RSS/Atom 解析（RSS 2.0 + Atom，含 CDATA、命名实体、`rel=alternate` 链接选择），`FeedStore` 以 `node:sqlite` 落本地库（`INSERT … ON CONFLICT(id) DO NOTHING`，重复抓取只更新正文、不重复计数）；`refreshFeeds()` 串行抓取、逐源独立容错；`normalizeDomain()` / `rankByDomain()` 做方向加权（标题 +3、主题标签 +2、摘要 +1，命中排除词归零）。CLI：`dsh-feeds sources|refresh|search|stats`。
- **资讯方向 `学习档案/资讯方向.json`**：`saveNewsDomain()` / `readNewsDomain()`，主题 ≤12、关键词与排除词 ≤40、单词 ≤40 字，大小写不敏感去重；这是「模型按专业重写提示词」的落点——改的是可读 JSON，不是代码。
- **onboarding 从「身份档案」扩到「资讯口径」**：`GroupId` 增加 `'news'`，`FIELDS` 增加 `newsInterest`（必填，select）与 `newsTopics`，分组顺序为 identity → news → goal → preference → resource（25 个字段 / 5 组）；Markdown 镜像与引导页由同一份 schema 数据驱动，新组自动出现。
- **5 个新工具**（18 → 23）：`study_news`（读本机 AIHOT `/api/v1/items`，`mode=selected|all`、`window=24h|7d`，连不上时明确给出「先起 AIHOT 或改用内置抓取」两条路）、`study_feeds_refresh`、`study_feeds_search`、`study_feeds_sources`、`study_news_domain_save`。
- `ToolsConfig.aihotBaseUrl`（默认 `http://127.0.0.1:3000`，可用环境变量 `ZHIHANG_AIHOT_BASE` 覆盖）与 `ToolsConfig.feedsDbPath`（默认 `<工作区>/学习档案/资讯.db`）。
- **知航 persona 增加「资讯雷达」职责与开场分支**：问到 `newsInterest` 时不许跳过；答「要」就追问方向并按专业重写口径，答「先不要」就记下不再推销；讲资讯的规矩是「一句价值 + 标题 + 原文链接 + 日期」，一次最多 3–5 条。

### 修复

- `refreshFeeds({ sources })` 同时接受源对象与源 id 时类型收窄失败（`FeedSource[]` 被当成 `string[]` 传进 `resolveSources`）→ 拆出 `pickSources()` 明确分支。
- onboarding 测试把分组与「里程碑记录」小节序号写死（新增 news 组后变成「六、里程碑记录」）→ 改为按 `GROUPS` 与标题正则断言。
- learning-tools 测试的离线 fetch 只认雷达与 GEO，新增资讯工具后会把真实网络请求打出去 → 补上 PLOS Atom 与 AIHOT items 两条假响应。

## [0.2.0] - 2026-11-18

知航从「你说什么我做什么」变成「先弄清你是谁，再决定说什么」：结构化档案 + 资源体检 + 可视化引导页 + 写进 persona 的开场协议。

### 新增

- **新包 `@dsh-learning/onboarding`**（无运行时依赖）：23 个字段 / 4 组（我是谁、我要去哪、
  我怎么配合、我的资源在哪）的结构化档案 schema；`profileStatus()` 把「还差什么」变成可计算的
  完成度与 `nextQuestions`；`saveProfile()` 合并式写入（答一条存一条，未知键进 `ignored`，
  同时产出 `个人档案.json` 与给人看的 `个人档案.md`，里程碑跨次保留）。
- **`checkResources()` 资源体检**：Zotero 数据库、Zotero 数据目录（有无 `storage/`）、
  本地索引库、联系邮箱、CARSI 学校五项，各给 `ok / warn / missing` 与一句「怎么补」。
- **`renderWizardHtml()` 单文件引导页**：4 组表单 + 实时 Markdown/JSON 预览 + 环形必填进度 +
  资源体检列表 + 下载 json/md、复制「发给知航」、草稿存 `localStorage`。纯静态、离线可开、
  内嵌 JSON 做了 `</script>` 转义。
- **4 个新工具**（14 → 18）：`study_profile_status`、`study_profile_save`、
  `study_resource_check`、`study_profile_wizard`。
- **知航 persona 的「开场协议」**：新会话第一句话之前先 `study_profile_status`；必填没齐就按
  `nextQuestions[0]` 一次只问一个问题、答一条存一条；然后 `study_resource_check` 报资源缺口；
  档案里有 `nextDeadline` 就提醒一行；用户说「不会填」时给引导页。开场不超过 5 行。
- `ToolsConfig.workspaceDir`：档案默认从工作区读，单次调用可覆盖。

### 修复

- 引导页内嵌 JSON 未转义 → 用户输入含 `</script>` 会截断脚本块。
- `questionFor()` 对 select 字段不给选项 → 追问时补上「可选项：…」。
- 资源体检体积只按 KB 显示 → `formatSize()` 超过 1 MB 用 MB。
- learning-tools 测试的临时工作区在 `describe` 收集阶段还没建好，导致档案被写进包目录
  （`completion` 断言得到 30 而不是 0）→ 改为模块顶层创建。

## [0.1.2] - 2026-11-17

资源目录从「门户条目」扩到「学校实际在订的库」，并给每一条标注了无登录实测的可达性。

### 新增

- **CARSI 资源目录 17 → 25 条**。对照康复大学图书馆的「中文数据库 / 外文数据库 / 试用数据库」
  三张订购清单后补齐 8 条高频库：ScienceDirect、Wiley Online Library、SciOpen、万方数据、
  维普中文期刊、中华医学期刊全文库（yiigle）、NSTL、国家哲学社会科学文献中心。
  此前问「中文文献去哪查」只会给出知网和读秀，问「医学临床文献」一个都指不出来。
- **`LibraryResource.reachable`**：`open` / `session` / `unreachable` 三态，记录 2026-11-17 的
  无登录实测结果。`openHint()` 据此分流：`session` 的给出入口 URL 并说明「不带本校登录态会被拦，
  属正常」；`unreachable` 的直接劝用户别在命令行反复重试（分区表 `fenqubiao.com` 在通用网络上
  DNS 就解析不出来，DDE 的 TLS 握手超时）。
- **`LIBRARY_EXTRAS`**：清单里还有、但与本项目方向相关性低因而未单列的免费资源
  （光学、地学、社科等），保留可查，不稀释推荐结果。
- 订阅库补齐 `url`（此前 17 条一个地址都没有，只有名字和备注）。

### 修复

- **arXiv 失败不再是一句 `fetch failed`**：实测不少校园网到 `export.arxiv.org` 的 TCP 443 不通
  （DNS 正常解析到 152.19.x 之外的 Fastly 段，连接超时）。现在 `describeFailure()` 会明确说
  「这是网络侧限制、不是插件故障，本轮先看 bioRxiv / medRxiv / PubMed」，免得用户以为程序坏了。
- 推荐表随目录更新：`literature-zh` 改为知网→万方→维普→中华医学期刊→NSTL→读秀，
  `literature-en` 加入 ScienceDirect 与 Wiley，`bioinformatics` 加入 ScienceDirect。

### 验证

`pnpm check` 全绿（154 个测试）。另外用 `dist/` 直接跑了一遍目录烟测：25 条、六类分布
`literature 14 / index 2 / data 2 / ai-tool 2 / compute 2 / course 2 / patent 1`，
三种 `reachable` 的 `openHint()` 输出均符合预期。

## [0.1.1] - 2026-11-17

首个在 CI 上真正跑通的版本。`v0.1.0` 的提交内容本身可用（本地 `pnpm check` 全绿），
但 GitHub Actions 里四个 job 全挂在装依赖那一步，仓库给人的第一印象是红的。

### 修复

- **CI 从未成功过**：workflow 里写了 `with: version: 11`，根 `package.json` 又声明了
  `packageManager: pnpm@11.28.5`，`pnpm/action-setup` 因此报
  `Multiple versions of pnpm specified ... ERR_PNPM_BAD_PM_VERSION`。删掉 workflow 里的
  `version`，统一以 `packageManager` 为准。
- **文档里的仓库地址**：`github.com/songyuhao0724/-AI-` 只是 301 跳转到规范名
  `dsh-learning`，README 的地址、`clone` 命令与 `cd` 目录名均已改正。

### 变更

- CI 动作升级到 `actions/checkout@v7`、`pnpm/action-setup@v6`（该版本起显式支持 pnpm 11）、
  `actions/setup-node@v7`，同时消掉 `Node.js 20 is deprecated` 告警。
- **scholar 的测试不再被慢机器判死**。Windows 托管 runner 上建一个 Zotero 夹具库要 3–6 秒
  （本机 150–300ms，差在杀软实时扫描新落盘的 `.sqlite`），于是默认配置在两个地方误判：
  1. `testTimeout`/`hookTimeout` 默认 5s/10s —— 把「机器慢」报成断言失败
     （[run 44000503729](https://github.com/songyuhao0724/dsh-learning/actions/runs/44000503729)，
     `pagesToChunks 每页一条` 这种纯函数用例也红了）；
  2. 多个测试文件并行时主线程喂不上 worker 的回调，抛
     `Error: [vitest-worker]: Timeout calling "onTaskUpdate"` —— 63 个测试全过仍判失败
     （[run 44001560645](https://github.com/songyuhao0724/dsh-learning/actions/runs/44001560645)）。
  对策：超时放宽到 30s，`pool: 'forks'` + `fileParallelism: false` 顺序跑文件，
  并把 `zotero.test.ts` 的夹具从「每个用例建一次」改成「整个文件建一次」（该文件的用例全只读）。
  真超时、真断言失败一样会红——改的是误判，不是阈值。
- **失败信息可被公开读取**：测试输出落盘，失败时把关键行压成一条 GitHub annotation。
  不登录 Actions 页面、只用公开 API 也能看到哪个用例挂了（此前失败只存在于需要登录才能下载的日志里；
  中途还踩过一次坑：vitest 用 ANSI 转义序列把 `FAIL ` 包起来，不剥颜色就 grep 不到）。

### 验证

- [run 44000503729](https://github.com/songyuhao0724/dsh-learning/actions/runs/44000503729) 与
  [run 44001560645](https://github.com/songyuhao0724/dsh-learning/actions/runs/44001560645) 分别暴露了
  上面两个问题（都是 Windows job 红、Ubuntu 绿）；修复后的验证见本版本 tag 所在提交的 CI。

## [0.1.0] - 2026-11-15

首个可用版本：DSH 里的「大学生 AI 学习系统」插件套件 —— 一个预设 + 14 个工具 + 5 个可独立调用的库。

### 新增

**预设**

- `@dsh-learning/preset-zhihang`：「知航 · AI 伴学助手」预设。不预设你是谁：先找工作区的
  `学习档案/个人档案.md`，没有就用最多 6 个问题建档（学校专业 / 年级 / 毕业打算 /
  当前最想解决的一件事 / 每周可投入时间 / 最担心的短板），之后围绕学业任务、学术需求、
  职业规划三件事工作，并明确不代写论文、不伪造数据。

**文献（scholar）**

- `study_papers_summary`：读 Zotero 库的统计（文献 / 附件 / 分类 / 类型分布），不改动 Zotero 数据。
- `study_papers_index`：把 Zotero 里有本地 PDF 的文献按页切块写入本地 SQLite 索引（幂等，可重复跑）。
- `study_papers_index_pdf`：索引单个 PDF（老师讲义、自己下载的论文），不经过 Zotero。
- `study_papers_search`：在本地索引里检索，返回**带文件名和页码**的片段，便于写作业时给出可核对出处。
- 实现要点：中文用重叠二元组预分词 + FTS5 短语匹配（`unicode61` 与 `Intl.Segmenter` 实测不适用）；
  PDF 抽取用 `unpdf`，抽前提是复制字节（pdf.js 会 detach `ArrayBuffer`）；
  Zotero 库被占用时读副本，不写原库；扫描件回退到 Zotero 的 `.zotero-ft-cache` 文本缓存。

**资源路由（carsi-router）**

- `study_resources`：按任务类型（查英文文献 / 查中文文献 / 期刊分区 / 科研数据 / AI 辅助学习 /
  课程 / 专利 / 生物信息分析）推荐学校 CARSI 应用资源门户里的入口，并给出「先登录再点开」的操作顺序。
- `study_access_route`：把 DOI / 标题 / PMID 丢给 Unpaywall、OpenAlex、Europe PMC，合并去重后
  给出**能直接点开的**获取路径；拿不到开放版本时明确说明，并指向学校资源。
- `study_search_formula`：把研究问题翻译成 PubMed / Web of Science / CNKI 专业检索 / Europe PMC
  能直接粘贴的检索式（含同义词组、年份、文献类型限定）。

**职业规划（career）**

- `study_career_occupations`：12 个生物信息 / 医学信息方向岗位画像（一天在做什么、学历门槛、核心技能）。
- `study_career_match`：按霍兰德 RIASEC 兴趣画像匹配岗位（24 题作答或六维分数）。
- `study_career_jd`：把招聘 JD 原文拆成结构化要求（学历、年限、职责、硬性要求、加分项、技能清单）。
- `study_career_gap`：对照岗位画像算技能差距，只承认带证据的技能，输出「最该补的 3 项」与
  「达到要求但缺证据」清单。
- `study_career_plan`：生成四年（或五年）发展计划，按毕业去向分叉，每年给技能时间线、优势、短板、
  目标与可交付物，另附备选方案。

**热点论文（paper-radar）**

- `study_papers_radar`：抓 arXiv / bioRxiv / medRxiv / PubMed 最近几天的论文，按 8 个主题打标、
  按 DOI 去重、按时间倒序，并直接产出符合 AIHOT `json_list` 信源契约的 JSON 端点内容。
- CLI `dsh-radar`：`topics` / `preview` / `export --out <file>` / `--source-config`，
  可以作为定时任务产出 AIHOT 的自定义信源。

**科研数据（bio-data）**

- `study_bio_data_search`：检索 NCBI GEO 数据集与 SRA 研究（E-utilities），并给出国家基因库
  CNGBdb / CNSA / GSA 的深链（国内平台检索接口需申请，只给入口不抓页面）。

**演示与工程**

- `scripts/demo.mjs`：一条命令跑通「建索引 → 带页码检索 → 资源路由 → 检索式 → 兴趣匹配 →
  技能差距 → 四年计划 → 热点论文 → 科研数据」全链路，`--online` 才联网、`--pdf` 可换成自己的 PDF。
- `scripts/validate-preset.mjs`：预设补丁的静态校验（必填 config、行 id 唯一、`!!js` 标签可解析），
  CI 里先跑它，避免「装得上但一选中就炸」。
- CI：Ubuntu + Windows × Node 22/24，`validate:preset → build → typecheck → test` 全绿（154 个测试）。

### 修复

- paper-radar 的 DOI 去重：当「后出现」的重复条目摘要更长而胜出时，旧实现会把胜者与败者
  **一起丢掉**（胜者从未进入按 id 的索引表）。v0.1.0 发布前的异构评审发现并修复，
  附回归测试（`packages/paper-radar/test/radar.test.ts`「同一 DOI 重复时保留摘要更长的一条」）。

### 文档

- `README.md`：七个包与 14 个工具的总览、两条安装路径、三个「不显然但关键」的技术决定、对接 AIHOT 的方法。
- `docs/integration.md`：使用者视角的安装、建档、配置、验证、卸载与故障排查。
- `docs/architecture.md`：为什么是插件而不是独立应用、包拓扑、五条数据流、存储位置、验收标准。
- `docs/review-v0.1.0.md` / `docs/review-report-v0.1.0.md` / `docs/review-evidence.md`：
  异构模型评审清单、逐条核对报告与演示证据的原样输出。
- `COMPLIANCE.md`：红线与边界（不绕过付费墙、不存他人的订阅凭证、单篇抓取交给 Zotero Connector）。

### 已知限制

- **arXiv 在部分校园网不可达**：抓取失败只作为一条提示，不影响其他源。
- **中文 PDF 依赖文本层**：扫描件需要先 OCR（或用 Zotero 已生成的全文缓存）。
- **CARSI 资源条目 17 条为人工复核的起点**：门户共 96 条，「校购 / 免费 / 试用」层级无法自动校验，
  路由话术不承诺一定免费；新增条目须附出处。
- **arXiv 按分类抓取**，不做关键词全文检索（那是另一个量级的事）。
- Bio 数据只做「检索 + 深链」，不下载、不镜像、不重分发原始数据。