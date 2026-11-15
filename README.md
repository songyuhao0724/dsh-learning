# dsh-learning · 大学生 AI 学习系统

> 一个装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的开源插件集合，让你的 AI 真正认识你的课表、你的文献库、你的职业规划。

**它不是另一个聊天机器人。** 它是给「一个人、四年、一条路」配的学伴：

- 它读过你 Zotero 里的论文，回答时能引到具体段落；
- 它知道你们学校买了哪些数据库，给一个 DOI 就能告诉你「能不能看、从哪进」；
- 它把「职业规划」从一次课堂作业变成四年可追踪的路线；
- 它把学科热点整理成一份你自己能读的日报，也能直接喂给你自己的热点站。

---

## 七个包，一件事

| 包 | 你做的事 | 它做的事 |
|---|---|---|
| **preset-zhihang** | 装一次，选一次 | 一个面向大学生的完整 agent「知航」：会拆任务、会调子智能体、会读写文件、会先建你的档案 |
| **scholar** | 把论文丢进 Zotero | 读文献库 → 抽 PDF 全文 → 建本地中文索引 → 带页码引用地回答你的问题 |
| **carsi-router** | 给一个 DOI / 检索需求 | 判断你能不能看、走哪个入口、生成 CNKI/WoS/PubMed 检索式 |
| **career** | 做一次测评、填一次档案 | 生成职业画像、四年路线与可验收的行动计划 |
| **paper-radar** | 说一句「我想要 XX 方向的热点」 | 抓 arXiv/bioRxiv/medRxiv/PubMed → 主题打标 → 输出 AIHOT `json_list` 信源 |
| **bio-data** | 问「GEO 里有没有 XX 的数据」 | 走 NCBI E-utilities 取 GEO / SRA 元数据；国内平台给门户深链 |
| **learning-tools** | 什么都不用做 | 把上面五个库变成 14 个 `study_*` 工具，装进任意 DSH 会话 |

### 14 个工具

| 组 | 工具 |
|---|---|
| 文献 | `study_papers_summary`、`study_papers_index`、`study_papers_index_pdf`、`study_papers_search` |
| 可得性 | `study_access_route`、`study_resources`、`study_search_formula` |
| 职业 | `study_career_occupations`、`study_career_match`、`study_career_jd`、`study_career_gap`、`study_career_plan` |
| 热点 | `study_papers_radar` |
| 科研数据 | `study_bio_data_search` |

---

## 快速开始

前置：已安装 DeepSeek Harness（桌面版或 Web 版）、Node ≥ 22.13、pnpm 11。

```pwsh
git clone https://github.com/<you>/dsh-learning.git
cd dsh-learning
pnpm install
pnpm build
```

两条路，任选：

**A. 要「知航」这个学伴**（含全部工具）：在 DSH 里安装预设 bundle，target 填 **`packages/preset-zhihang` 的绝对路径**；新建会话时在预设下拉里选 **「知航 · AI 伴学助手」**。

**B. 只要工具**（不动你现有的预设）：安装 **`packages/learning-tools` 的绝对路径**。它是一行 profile 级插件，装完所有预设都能用。

第一次对话时「知航」会问你 6 个问题建立 `学习档案/个人档案.md`——这是它认识你的起点。详细步骤、配置项、故障排查见 **[docs/integration.md](./docs/integration.md)**。

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
│   ├── preset-zhihang/   # 「知航」agent 预设 + 完整工具集
│   ├── scholar/          # Zotero → 全文 → 本地索引 → 带引用问答，CLI: dsh-scholar
│   ├── carsi-router/     # 资源画像 + 可得性路由 + 检索式生成
│   ├── career/           # RIASEC 画像 + 12 个岗位 + JD 解析 + 四年路线
│   ├── paper-radar/      # 热点论文雷达 → AIHOT 信源，CLI: dsh-radar
│   ├── bio-data/         # GEO / SRA 检索 + 国内平台深链
│   └── learning-tools/   # 14 个 study_* 工具的 DSH 插件壳
├── docs/
│   ├── architecture.md   # 架构、数据流、验收标准
│   ├── integration.md    # 安装、配置、验证、故障排查
│   └── spec/             # 实现规格（DSH 插件 API、Zotero schema、CARSI 资源）
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
| **M6** | 文档、演示、v0.1.0 发版 | 🚧 |

`pnpm check` = 预设校验 + 全量构建 + 类型检查 + **153 个测试**。

---

## 技术选型

- **中文分词/检索**：重叠二元组 + SQLite **FTS5**（Node 内置 `node:sqlite`，零原生依赖）；向量检索是可选扩展，不需要 embedding 也能用。
- **PDF 抽取**：`unpdf`（pdfjs 的纯 JS 封装，钉 1.9.x 以兼容 Node 22）。
- **Zotero**：直接只读 `zotero.sqlite`（被锁时读副本），不装 Zotero 插件、不改它的数据。
- **不引入重型全栈**：没有 Flask / FastAPI / PostgreSQL / Docker——这些包跑在 DSH 进程里，或者作为 CLI。

---

## 参与贡献

欢迎 issue / PR。请先读 [COMPLIANCE.md](./COMPLIANCE.md)：**涉及绕过访问控制、批量抓取、伪造数据的 PR 一律不合入。**

## License

[Apache-2.0](./LICENSE) © 2026 dsh-learning contributors

CARSI 是 CERNET 提供的联邦认证服务；本仓库仅对公开可见的资源清单做事实性指称，不代表或关联 CERNET。MBTI 是 Myers-Briggs Type Indicator Trust 的注册商标，本项目不使用该名称，只用公共领域的霍兰德 RIASEC 六维模型。