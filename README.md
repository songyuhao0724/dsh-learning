# dsh-learning · 大学生 AI 学习系统

> 一个装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的开源插件集合，让你的 AI 真正认识你的课表、你的文献库、你的职业规划。

**它不是另一个聊天机器人。** 它是给「一个人、四年、一条路」配的学伴：

- 它读过你 Zotero 里的论文，回答时能引到具体段落；
- 它知道你们学校买了哪些数据库，给一个 DOI 就能告诉你「能不能看、从哪进」；
- 它把「职业规划」从一次课堂作业变成四年可追踪的路线；
- 它把学科热点整理成一份你自己能读的日报。

---

## 六大模块

| 模块 | 你做的事 | 它做的事 |
|---|---|---|
| **知航预设** | 装一次，选一次 | 一个面向大学生的完整 agent：会拆任务、会调子智能体、会读写文件 |
| **scholar** | 把论文丢进 Zotero | 读文献库 → 抽 PDF 全文 → 建本地中文索引 → 带页码引用地回答你的问题 |
| **carsi-router** | 给一个 DOI / 检索需求 | 判断你能不能看、走哪个入口、生成 CNKI/WoS/PubMed 检索式 |
| **career** | 做一次测评、填一次档案 | 生成职业画像、四年路线与可验收的行动计划，导出 Word |
| **paper-radar** | 说一句「我想要 XX 方向的热点」 | 抓 arXiv/bioRxiv/medRxiv/PubMed → 主题打标 → 输出给你的日报系统 |
| **bio-data** | 问「GEO 里有没有 XX 的数据」 | 走 NCBI E-utilities / GEO / SRA 等公开接口取元数据 |

> 模块状态见 [路线图](#路线图)。M1/M2 已完成前，除预设外的模块会逐步落地。

---

## 快速开始

前置：已安装 DeepSeek Harness（桌面版或 Web 版）。

```pwsh
# 1. 克隆
git clone https://github.com/<you>/dsh-learning.git
cd dsh-learning

# 2. 安装依赖并构建
pnpm install
pnpm build
```

然后在 DSH 里安装预设 bundle（GUI：插件管理 → 安装本地 bundle；或让 AI 调用 `install_bundle`），把 **`packages/preset-zhihang` 的绝对路径**作为 target。

安装成功后，新建会话时在预设下拉里选择 **「知航 · AI 伴学助手」**。

第一次对话，它会问你 6 个问题建立你的 `学习档案/个人档案.md`——这是它认识你的起点。

---

## 设计原则

1. **不碰付费墙。** 不做爬虫、不存 cookie、不批量下载、不绕验证码与 DRM。付费墙后的那一层永远留在你自己的浏览器里。
2. **本地优先。** 文献索引、个人档案、使用记录都存在你自己的机器上；只有你显式选择的公开元数据接口才会出网。
3. **可验证。** 每个模块都必须能被「真实安装 + 真实数据 + 真实提问」跑通，而不是只在文档里存在。

详见 [COMPLIANCE.md](./COMPLIANCE.md)。

---

## 目录结构

```
dsh-learning/
├── packages/
│   ├── preset-zhihang/   # 「知航」agent 预设（M1）
│   ├── scholar/          # Zotero → 全文 → 本地索引 → 带引用问答（M2）
│   ├── carsi-router/     # 资源画像 + 可得性路由 + 检索式生成（M3）
│   ├── career/           # 职业画像 + 四年路线 + 报告导出（M4）
│   ├── paper-radar/      # 学科热点 → 日报信源（M5）
│   └── bio-data/         # NCBI / GEO / SRA 元数据（M5）
├── docs/
│   ├── architecture.md   # 架构与数据流
│   └── spec/             # 实现规格（插件 API、Zotero schema、CARSI 资源）
├── data/                 # 随仓库分发的公开数据（资源画像等）
├── COMPLIANCE.md         # 合规边界：我们做什么、不做什么
└── LICENSE               # Apache-2.0
```

---

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 仓库骨架 + 知航预设 + CI | 🚧 |
| **M2** | scholar：Zotero 只读 → PDF 抽取 → FTS5 中文索引 → 带页码引用问答 | ⏳ |
| **M3** | carsi-router：96 资源画像 + 可得性路由 + 检索式生成 | ⏳ |
| **M4** | career：测评 + 画像 + 四年路线 + Word 报告导出 | ⏳ |
| **M5** | paper-radar（对接 AIHOT `json_list` 信源）+ bio-data | ⏳ |
| **M6** | 文档、合规审查、演示、v0.1.0 发版 | ⏳ |

---

## 技术选型说明

- **中文分词**：Node 24 内置 `Intl.Segmenter('zh', { granularity: 'word' })`，零依赖，避免 `nodejieba` 的原生编译地狱。
- **全文检索**：SQLite **FTS5** 词法检索做基础层；向量检索作为**可选**插件（需要自备 OpenAI 兼容的 embedding 端点）。
- **PDF 抽取**：`pdfjs-dist`（纯 JS，跨平台）。
- **不引入重型全栈**：没有 Flask/FastAPI/PostgreSQL/Docker——插件跑在 DSH 进程里。

---

## 参与贡献

欢迎 issue / PR。请先读 [COMPLIANCE.md](./COMPLIANCE.md)：**涉及绕过访问控制、批量抓取、伪造数据的 PR 一律不合入。**

---

## License

[Apache-2.0](./LICENSE) © 2026 dsh-learning contributors

CARSI 是 CERNET 提供的联邦认证服务；本仓库仅对公开可见的资源清单做事实性指称，不代表或关联 CERNET。MBTI 是 Myers-Briggs Type Indicator Trust 的注册商标，本项目不使用该名称。