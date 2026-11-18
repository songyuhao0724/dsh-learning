# dsh-learning · 大学生 AI 学习系统

> 一个装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的开源插件集合，让你的 AI 真正认识你的课表、你的文献库、你的职业规划。

**它不是另一个聊天机器人。** 它是给「一个人、四年、一条路」配的学伴：

- 它读过你 Zotero 里的论文，回答时能引到具体段落；
- 它知道你们学校买了哪些数据库，给一个 DOI 就能告诉你「能不能看、从哪进」；
- 它把「职业规划」从一次课堂作业变成四年可追踪的路线；
- 它把学科热点整理成一份你自己能读的日报，也能直接喂给你自己的热点站。

---

## 八个包，一件事

| 包 | 你做的事 | 它做的事 |
|---|---|---|
| **preset-zhihang** | 装一次，选一次 | 一个面向大学生的完整 agent「知航」：会拆任务、会调子智能体、会读写文件、会先建你的档案 |
| **scholar** | 把论文丢进 Zotero | 读文献库 → 抽 PDF 全文 → 建本地中文索引 → 带页码引用地回答你的问题 |
| **carsi-router** | 给一个 DOI / 检索需求 | 判断你能不能看、走哪个入口、生成 CNKI/WoS/PubMed 检索式 |
| **career** | 做一次测评、填一次档案 | 生成职业画像、四年路线与可验收的行动计划 |
| **paper-radar** | 说一句「我想要 XX 方向的热点」 | 抓 arXiv/bioRxiv/medRxiv/PubMed → 主题打标 → 输出 AIHOT `json_list` 信源 |
| **bio-data** | 问「GEO 里有没有 XX 的数据」 | 走 NCBI E-utilities 取 GEO / SRA 元数据；国内平台给门户深链 |
| **feeds** | 说一句「有什么新进展」 | 抓 27 个外国免费信源（期刊/预印本/厂商/机构/媒体/社区）→ 入本地 SQLite → 按你的方向检索，CLI: `dsh-feeds` |
| **onboarding** | 第一次用的时候填一遍档案 | 结构化个人档案（25 个字段 / 5 组）+ 资源体检 + 单文件引导页 `初始化向导.html` |
| **learning-tools** | 什么都不用做 | 把上面七个库变成 23 个 `study_*` 工具，装进任意 DSH 会话 |

### 23 个工具

| 组 | 工具 |
|---|---|
| 文献 | `study_papers_summary`、`study_papers_index`、`study_papers_index_pdf`、`study_papers_search` |
| 可得性 | `study_access_route`、`study_resources`、`study_search_formula` |
| 职业 | `study_career_occupations`、`study_career_match`、`study_career_jd`、`study_career_gap`、`study_career_plan` |
| 热点 | `study_papers_radar` |
| 科研数据 | `study_bio_data_search` |
| 档案与初始化 | `study_profile_status`、`study_profile_save`、`study_resource_check`、`study_profile_wizard` |
| 资讯 | `study_news`、`study_feeds_refresh`、`study_feeds_search`、`study_feeds_sources`、`study_news_domain_save` |

---

## 快速开始

仓库地址：**https://github.com/songyuhao0724/dsh-learning**

前置：已安装 DeepSeek Harness（桌面版或 Web 版）、Node ≥ 22.13、pnpm 11。

```pwsh
git clone https://github.com/songyuhao0724/dsh-learning.git
cd dsh-learning
pnpm install
pnpm build
```

装两样东西，**必装的是第一样**：

**① 装工具（必需）**：在 DSH 里安装 **`packages/learning-tools` 的绝对路径**。它是一条 profile 级插件，装完 23 个 `study_*` 在你所有预设、所有会话里都能用。

**② 装人设（可选但有更好）**：再安装 **`packages/preset-zhihang` 的绝对路径**，新建会话时在预设下拉里选 **「知航 · AI 伴学助手」**。它只带人设和通用能力（拆任务、子智能体、文件、网页、Office、计划模式）——**不含任何 `study_*` 工具**，所以①和②是互补关系，不是二选一。

> 为什么拆成两条 bundle？工具（`learning-tools`）是 profile 级插件，天然对所有预设生效；人设（`preset-zhihang`）只是一个 agent 预设。把它们塞进同一个 bundle 会让「只想用工具、不想换预设」的人被绑上知航的人设，反过来也会让同时装两份的人重复挂载同一插件。宁可多写一行字，也不留这个坑。

装完重启 DSH（插件在会话启动时读入，热更只会让工具短暂消失）。

第一次对话时，知航**不会先问你六个问题**，而是先读档案再决定说什么（见下节）。

---

## 知航为什么「主动」（v0.2.0）

普通问答助手每次都要你重新交代背景。知航的做法是把「认识你」这件事做成三个可执行动作：

**1. 结构化档案，而不是一段散文。** 档案在 `<工作区>/学习档案/个人档案.json`（25 个字段 / 5 组：我是谁、要不要盯资讯、我要去哪、我怎么配合、我的资源在哪），由工具读写，同时生成一份给人看的 `个人档案.md`。字段有必填标记，因此「还差什么」是可计算的，不是靠模型自己回忆。

**2. 开场协议写进 persona。** 每次新会话、回答第一句话之前：先 `study_profile_status` → 必填没齐就用它的 `nextQuestions[0]` **一次只问一个问题**，答一条存一条 → 再 `study_resource_check` 报资源缺口（Zotero 库、数据目录、索引库、邮箱、CARSI 学校）→ 档案里有 `nextDeadline` 就提醒一行。开场不超过 5 行。

**3. 不想填的时候有可视化引导。** `study_profile_wizard` 生成单文件 `学习档案/初始化向导.html`：左侧 5 组表单、右侧实时 Markdown/JSON 预览、右上角环形进度（必填完成度）、下方资源体检，填完可下载 json 直接覆盖档案。页面纯静态、离线可开，草稿存 `localStorage`。

回写也是一条硬规则：你说过的长期信息、有节点意义的事（交作业、定方向、考完试）都会当场写回档案，所以越用越准。

---

## 内置资讯雷达（v0.3.0）

学校买了什么库，很大程度上决定你能看到什么。但**外国期刊的目次、预印本、厂商博客、研究机构动态，本来就是免费公开的**——缺的不是订阅，是一个替你筛、替你翻、替你盯的人。v0.3.0 把这件事内置进来：

**两档数据源，自己选。**

- **有 AIHOT 实例**（自托管的 AI 热点站，见下节）：`study_news` 直接读它已经筛过、翻成中文的条目，省一次 LLM 调用。
- **没有也能跑**：`study_feeds_refresh` 抓内置 27 个源入本地 SQLite（`学习档案/资讯.db`），`study_feeds_search` 按关键词 / 时间窗 / 源 / 主题检索，`study_feeds_sources` 列清单。零运行时依赖、零外部服务。

**27 个源，六类**：期刊（PLOS Comp Biol、Nature Methods、Nature Biotech、Cell Genomics）、预印本（bioRxiv）、厂商官方（OpenAI、DeepMind、Google Research、HF、MSR、NVIDIA、AWS、GitHub、Mistral）、研究机构（BAIR）、媒体（The Verge、TechCrunch、Ars Technica、MIT TR、The Decoder、GEN）、社区（Simon Willison、Import AI、Latent Space、R-bloggers、Loman Lab、Haldane's Sieve）。全部英文、全部免费、全部公开。

**方向是写下来的，不是每轮现编的。** 初始化时问一句「要不要盯外国资讯」，要就让模型按你的专业重写口径（主题、英文关键词、排除词、评分备注），存 `学习档案/资讯方向.json`；之后检索带 `domainOnly` 就按方向打分排序（标题命中 +3、主题标签 +2、摘要 +1），改方向一次就够。这就是「模型做提示词重写」在知航里的落点——不是改代码，是写一个可读的 JSON。

诚实说明两点：bioRxiv 与部分站点对爬虫 UA 有 Cloudflare 拦截，抓不到就如实报错（不伪造条目）；`study_news` 那种「精选/翻译」质量来自 AIHOT 的提示词资产，本仓库只复用它的接口，不复制它的模型调用。

---

## 设计原则

1. **不碰付费墙。** 不做爬虫、不存 cookie、不批量下载、不绕验证码与 DRM。付费墙后的那一层永远留在你自己的浏览器里。
2. **本地优先。** 文献索引、个人档案、检索记录都存在你自己的机器上；只有你显式选择的公开元数据接口才会出网。
3. **可验证。** 每个模块都必须能被「真实安装 + 真实数据 + 真实提问」跑通，而不是只在文档里存在——所以仓库里每个包都带测试，`pnpm check` 一条命令跑完。

详见 [COMPLIANCE.md](./COMPLIANCE.md)。

---

## 三个「不显然但关键」的技术决定

**中文检索：重叠二元组 + FTS5 短语匹配。** SQLite FTS5 的 `unicode61` 分词器不切中文（实测「康复」「神经网络」「序列比对」全部 0 命中），`Intl.Segmenter('zh')` 又会把「卷积」切成「卷|积」。最终方案是索引侧把汉字串切成重叠 2-gram（`卷积神经网络` → `卷积 积神 神经 经网 网络`），查询侧转成 FTS5 短语 `"卷积 积神 神经 经网 网络"`；精度靠短语、召回靠 OR 兜底与单字 LIKE 兜底。代价是二元组会跨词边界，所以片段高亮按**原始查询词**做，不按索引 token。

**PDF 抽取：先复制字节。** pdf.js 会把传入的 `ArrayBuffer` **转移（detach）** 给 worker，同一份字节第二次用就报 `DataCloneError`。所以 `Uint8Array.from(input)` 先复制再交出去。

**工具注册：不 import `@deepseek-ai/*`。** DSH 的 Loader 从 **profile 根**解析模块，第三方 link 包只有自己声明的依赖能被解析到，而 `@deepseek-ai/dsh-tools` 只在 app.asar 里。`ToolSchema.parameters` 的类型本来就是 `Record<string, unknown>`，所以工具定义可以直接用最小结构的普通对象传给 `ctx.tools.register()`。

---

## 对接 AIHOT（热点论文变信源）

[dsh-paper-radar] 抓到的论文可以用 `json_list` 信源零侵入接进 [AIHOT](https://github.com/KKKKhazix/AIHOT) 这一类「自托管热点站」：

```bash
node packages/paper-radar/dist/cli.js export --out radar.json --days 7 --topics medical-ai,genomics
```

命令会写出 `{"data":{"items":[...]}}` 并打印对应的采集配置（`mode: json_api`、`itemsPath: data.items`、`urlTemplate: {raw:url}`、`publishedAtPath: published_at`、`externalIdPath: id`）。把 JSON 放到任意静态地址，在热点站里新增一条 `json_list` 信源、把配置粘进去即可。

`aihotSourceConfig()` **只产出 AIHOT 文档里出现过的键**——它收到不认识的配置项会拒绝整条信源，所以这个白名单是刻意收紧的。

---

## 目录结构

```
dsh-learning/
├── packages/
│   ├── preset-zhihang/   # 「知航」agent 预设（人设 + 通用能力，不含 study_* 工具）
│   ├── scholar/          # Zotero → 全文 → 本地索引 → 带引用问答，CLI: dsh-scholar
│   ├── carsi-router/     # 资源画像 + 可得性路由 + 检索式生成
│   ├── career/           # RIASEC 画像 + 12 个岗位 + JD 解析 + 四年路线
│   ├── paper-radar/      # 热点论文雷达 → AIHOT 信源，CLI: dsh-radar
│   ├── bio-data/         # GEO / SRA 检索 + 国内平台深链
│   ├── feeds/            # 27 个外国免费信源 → 本地 SQLite → 按方向检索，CLI: dsh-feeds
│   ├── onboarding/       # 结构化档案 + 资源体检 + 单文件引导页
│   └── learning-tools/   # 23 个 study_* 工具的 DSH 插件壳
├── docs/
│   ├── architecture.md   # 架构、数据流、验收标准
│   ├── integration.md    # 安装、配置、验证、故障排查
│   ├── review-v0.1.0.md     # 发布前的可证伪评审清单（给异构模型用）
│   ├── review-report-v0.1.0.md  # 评审报告：34 项断言逐条判定 + 1 个真 bug 的复现与修复
│   └── review-evidence.md   # 演示证据的原样输出（离线 / 联网 / 中文 PDF）
├── COMPLIANCE.md         # 合规边界：我们做什么、不做什么
└── LICENSE               # Apache-2.0
```

---

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 仓库骨架 + 知航预设 + CI + 预设校验器 | ✅ |
| **M2** | scholar：Zotero 只读 → PDF 抽取 → FTS5 中文索引 → CLI | ✅ |
| **M3** | carsi-router：资源画像 + 可得性路由 + 检索式生成 | ✅ |
| **M4** | career：RIASEC + 12 岗位 + JD 解析 + 技能差距 + 四年路线 | ✅ |
| **M5** | paper-radar（AIHOT `json_list`）+ bio-data + 14 个工具装进 DSH | ✅ |
| **M6** | 文档、演示、v0.1.0 发版 | ✅ |
| **M7** | 知航主动化：结构化档案 + 资源体检 + 引导页 + 开场协议（v0.2.0） | ✅ |
| **M8** | 内置资讯：27 个免费信源 + 方向口径 + 5 个工具，接 AIHOT 或独立跑（v0.3.0） | ✅ |

`pnpm check` = 预设校验 + 全量构建 + 类型检查 + **196 个测试**。

---

## 技术选型

- **中文分词/检索**：重叠二元组 + SQLite **FTS5**（Node 内置 `node:sqlite`，零原生依赖）；向量检索是可选扩展，不需要 embedding 也能用。
- **PDF 抽取**：`unpdf`（pdfjs 的纯 JS 封装，钉 1.9.x 以兼容 Node 22）。
- **Zotero**：直接只读 `zotero.sqlite`（被锁时读副本），不装 Zotero 插件、不改它的数据。
- **资讯抓取**：自写极简 RSS/Atom 解析（正则切条 + 实体解码 + CDATA 还原），不引第三方 XML 库；条目没有 `guid`/`link` 时用「源 + 标题哈希」生成稳定 id，重抓不会重复入库。
- **不引入重型全栈**：没有 Flask / FastAPI / PostgreSQL / Docker——这些包跑在 DSH 进程里，或者作为 CLI。

---

## 参与贡献

欢迎 issue / PR。请先读 [COMPLIANCE.md](./COMPLIANCE.md)：**涉及绕过访问控制、批量抓取、伪造数据的 PR 一律不合入。**

## License

[Apache-2.0](./LICENSE) © 2026 dsh-learning contributors

CARSI 是 CERNET 提供的联邦认证服务；本仓库仅对公开可见的资源清单做事实性指称，不代表或关联 CERNET。MBTI 是 Myers-Briggs Type Indicator Trust 的注册商标，本项目不使用该名称，只用公共领域的霍兰德 RIASEC 六维模型。