# 把「知航」预设与工具集装进你的 DeepSeek Harness

本文是**使用者**视角的安装文档。开发者视角的包结构见 [architecture.md](./architecture.md)。

---

## 0. 装之前先确认版本

- DeepSeek Harness `>= 0.2.0-rc.1 < 0.3.0`（`engines.dsh`；预发布版本参与匹配）
- Node `>= 22.13`（仓库用它跑构建与测试；DSH 桌面端自带运行时，普通用户不用单独装）

在 DSH 里问一句「DSH 是什么版本」，或在设置里看关于页即可。

---

## 1. 选一种安装方式

### 方式 A：装「知航」预设（推荐，得到完整伴学人格 + 全套工具）

1. 把本仓库克隆到本地任意目录（**不要放在 OneDrive / iCloud 等同步盘里**，`.git` 和 `node_modules` 会被同步搅乱）：

   ```bash
   git clone https://github.com/<你的账号>/dsh-learning.git
   ```

2. 在 DSH 里让助手执行（或自己调用 `plugin_manager`）：

   ```text
   plugin_manager install_bundle(target="<仓库绝对路径>/packages/preset-zhihang")
   plugin_manager install_bundle(target="<仓库绝对路径>/packages/learning-tools")
   ```

3. 新建会话，在预设选择器里选**「知航 · AI 伴学助手」**。

### 方式 B：只装工具，不要人格

只装 `packages/learning-tools`，然后在任意预设里使用下面 18 个 `study_*` 工具。

> 工具默认挂在 profile 顶层，所以**所有预设**都能看到它们。只想给「知航」用，
> 就把 `packages/learning-tools/cordis.patch.yml` 里那一行搬进
> `packages/preset-zhihang/cordis.patch.yml` 的 `config.plugins` 数组（见下方 §3）。

---

## 2. 第一次使用：建档案 + 建索引

「知航」开工前会先调 `study_profile_status` 读工作区的结构化档案
`学习档案/个人档案.json`（23 个字段 / 4 组）。必填没齐时它**一次只问一个问题**，
答一条存一条；不会再一口气抛六个问题。

### 2.1 三种建档方式，任选

| 方式 | 怎么做 | 适合 |
|---|---|---|
| 对话式 | 直接跟知航说话，它按 `nextQuestions` 逐个问 | 懒人，边聊边填 |
| 可视化引导页 | 说「给我个引导页」或直接调 `study_profile_wizard`，双击生成的 `学习档案/初始化向导.html` 填写 | 想一次看完所有字段、要看到进度条 |
| 手工编辑 | 直接改 `学习档案/个人档案.json`（字段目录见 `packages/onboarding/src/schema.ts`） | 想批量粘贴 |

引导页填完点「下载 个人档案.json」，覆盖 `学习档案/个人档案.json` 即可；它同时会生成
`个人档案.md` 供你肉眼检查。

### 2.2 资源体检

`study_resource_check` 检查五项：Zotero 数据库、Zotero 数据目录（要有 `storage/`）、
本地索引库、联系邮箱（Unpaywall 要求）、CARSI 学校。每项给 `ok / warn / missing`
和一句「怎么补」，所以开场就能知道你缺什么，而不是等到检索失败才发现。

文献能力是**读你自己的 Zotero 库**，所以先确认两件事：

1. Zotero 7 已经登录并抓过几篇文献（用浏览器扩展 + 学校 CARSI 登录态单篇抓取，这是 Zotero 的成熟边界）；
2. 知道两个路径：
   - `zotero.sqlite`：一般在 `C:\Users\<你>\Zotero\zotero.sqlite`
   - 数据目录：`C:\Users\<你>\Zotero`（含 `storage/`）

然后对助手说「把我的 Zotero 建个索引」，它会调 `study_papers_index`。
之后任何作业都能说「按我图书馆里的文献写，带页码引用」。

### 建议：把常用路径写进插件配置（省得每次传参）

在 profile 的插件设置里给 `learning-tools` 填：

```yaml
config:
  zoteroDbPath: C:/Users/<你>/Zotero/zotero.sqlite
  zoteroDataDir: C:/Users/<你>/Zotero
  indexDbPath: <你的工作区>/.dsh-learning/index.db
  contactEmail: <你的邮箱>   # 查 Unpaywall 需要，它要求表明身份
```

---

## 3. 让工具只对「知航」可见（可选）

`packages/preset-zhihang/cordis.patch.yml` 的 `config.plugins` 是普通 Cordis 行列表，
加一行即可（`name` 由 Loader 从 profile 根解析，所以必须是已装进 profile 的包名）：

```yaml
        - id: learning-tools
          name: '@dsh-learning/learning-tools'
```

同时把 `packages/learning-tools/cordis.patch.yml` 里的 insert 行删掉，避免重复注册
（同名工具重复注册会抛 `tool "..." is already registered`）。

---

## 4. 验证装好了

新建一个会话，选「知航」，问：

- **只看它开不开场**：什么都不说，第一句就该是「档案完整度 N%，还差 X / 资源哪项没配」这种话 → 触发 `study_profile_status` + `study_resource_check`
- 「你能查我 Zotero 库里有哪些文献吗？」→ 应触发 `study_papers_summary`
- 「帮我把『脑卒中 深度学习』翻译成 PubMed 检索式」→ 应触发 `study_search_formula`
- 「按医疗健康大数据方向给我一份四年计划」→ 应触发 `study_career_plan`
- 「最近一周医学影像方面有什么新论文？」→ 应触发 `study_papers_radar`
- 「GEO 里有没有单细胞肺癌的数据？」→ 应触发 `study_bio_data_search`

命令行的旁路验证（不经过 DSH）：

```bash
pnpm install && pnpm build
node packages/scholar/dist/cli.js summary --db C:/Users/<你>/Zotero/zotero.sqlite --data C:/Users/<你>/Zotero
node packages/paper-radar/dist/cli.js preview --days 3 --per-source 5
```

> 热点雷达会同时抓 arXiv / bioRxiv / medRxiv（给了 `--query` 才查 PubMed）。
> **部分校园网访问不到 arXiv**，这时它只会在结果里留一条 warning，其它源照常返回。

---

## 5. 卸载

```text
plugin_manager remove_bundle(target="@dsh-learning/learning-tools")
plugin_manager remove_bundle(target="@dsh-learning/preset-zhihang")
```

---

## 6. 出问题先看这里

| 现象 | 原因 | 处理 |
|---|---|---|
| 选预设时报 `PlanModeConfig needs a string section` | 预设的 `plan-mode` 行少了 `config.section` | 用仓库里的 `scripts/validate-preset.mjs` 自检，或拉最新代码 |
| 工具没出现 | 包没装进 profile，或 `inject` 服务名写错 | `plugin_manager list_bundles` 看该 bundle 的 `rows` 与 `error` |
| 检索永远 0 命中 | 索引是空的，或查询是单个汉字 | 先 `study_papers_index`；单字查询会走 LIKE 兜底，效果弱 |
| `PDF 内容是空的（0 字节）` | PDF 文件损坏，或上次传入的 ArrayBuffer 被 pdf.js 转移了 | 换一份 PDF 重试；这是已知的 pdf.js 行为，模块内已做拷贝 |
| 扫描件索引出 0 页 | 没有文字层 | 让 Zotero 先 OCR（它对 PDF 做全文索引时会调 OCR），再索引；模块会优先回落 `.zotero-ft-cache` |
| 查不到开放获取全文 | 这篇论文本来就没有 OA 版本 | 这很正常：工具会给学校 CARSI 资源建议，不会替你绕付费墙 |
| 雷达里 arXiv 一直是 0 条 + 「arXiv 抓取失败」 | 校园网或代理拦住了 `export.arxiv.org` | 换网络（手机热点）再试；其它源不受影响 |
| `study_bio_data_search` 报「没有可用的 fetch」 | 运行环境没有全局 `fetch`（Node < 18 或旧 Electron） | 升级 DSH；或在插件配置里注入 fetch |
| 知航开场不读档案、直接问「你是谁」 | 会话不是「知航」预设（用别的预设时没有这段 persona） | 新建会话选「知航」；或把 `packages/learning-tools` 装成 profile 级插件后手动说「看下我的档案」 |
| 档案改了但知航还用旧信息 | 档案在 `学习档案/个人档案.json`，工具每次重新读；旧信息来自会话上下文 | 开新会话，或让它重跑一次 `study_profile_status` |
| 引导页填写后进度不动 | 页面用了 `localStorage` 草稿，被浏览器隐私模式禁用 | 换普通窗口打开；或直接手工编辑 json |
| 引导页下载的 json 覆盖后字段没生效 | 覆盖到了别的目录（比如 `AI伴学助手/`） | 确认路径是 `<工作区>/学习档案/个人档案.json` |