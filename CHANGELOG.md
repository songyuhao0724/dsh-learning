# 更新日志

本项目的所有重要变更都记录在这里。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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