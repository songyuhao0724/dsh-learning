# v0.1.0 异构评审报告

- 评审时间：2026-11-15
- 评审模型：qwen3.8-max-0902（实现由 deepseek-v4.1-flash-1017 完成 —— 评审者与实现者异源）
- 评审依据：`docs/review-v0.1.0.md` 的 9 组断言；证据一律来自本轮**重新执行**的命令、
  文件读取与新增测试，不采信实现过程中的自述。
- 结论速览：**34 项断言 = 32 通过 / 1 不通过（已当场修复并加回归测试）/ 1 无法在本环境验证**。
  修复后全仓 `pnpm check` 通过，**154 个测试全绿**。

## 判定汇总

| 节 | 主题 | 结果 |
|---|---|---|
| 1 | 预设 preset-zhihang | 6/6 通过 |
| 2 | 检索质量 scholar | 7/7 通过 |
| 3 | 资源路由 carsi-router | 5/5 通过 |
| 4 | 职业规划 career | 5/5 通过 |
| 5 | 热点论文 paper-radar | 3/4 通过，**1 不通过 → 已修复** |
| 6 | 科研数据 bio-data | 3/3 通过 |
| 7 | 插件接线 learning-tools | 4/4 通过 |
| 8 | 交付与合规 | 4/4 通过（其中「GUI 真加载」留待用户人工验证） |
| 9 | 挑刺点 | 见逐条回应，1 条记入 v0.2 待办 |

## 1. 预设（packages/preset-zhihang）—— 全部通过

1. **1 行 insert、行 id 唯一、persona prefix 非空**：`cordis.patch.yml` 共 177 行，
   唯一 `- insert:` 行 id=`preset-zhihang`（:9-10）；persona `prefix: |` 非空多行文本（:21-53）。
   `scripts/validate-preset.mjs` 在 CI 里静态校验同样内容，本轮重跑输出「✓ … 1 行 insert，1 个顶层 id」。
2. **plan-mode `config.section` 存在且非空**：`cordis.patch.yml:99-111`，且 :97-98 有注释说明
   「留空或缺失会让插件在加载时抛 `PlanModeConfig needs a string \`section\``」。
   与 asar 内官方 `dsh-plan-mode` 源码的校验逻辑（`typeof section !== "string"` / 空串抛错）一致。
3. **persona 不预设用户身份**：:25-28 明确「先在工作区找 `学习档案/个人档案.md`；不存在则用
   ask_user_question 做不超过 6 问的建档访谈」。全文无姓名/学校/年级硬编码。
4. **工具集与官方 standard 等价**：本轮用 Electron(`ELECTRON_RUN_AS_NODE=1`) 从
   `app.asar` 内读出官方 `dsh-web-app/presets/standard.patch.yml`，与 zhihang 补丁做**结构化 diff**
   （YAML 解析后归一化 persona 正文/预设 id/name/description/order）：输出
   `STRUCTURE-IDENTICAL`。33 个插件行 id 完全一致；`!!js` 表达式（win32 判断、customSkillDirs、
   `!ctx.get('profileContext')`）逐行文本一致。
5. **plugin-manager 行带 `disabled: !!js "!ctx.get('profileContext')"`**：:174。
6. **plugin-market 停用**：:177 `disabled: true`，与 standard 一致。

## 2. 检索质量（packages/scholar）—— 全部通过

1. **二元组而非 unicode61/Segmenter**：`src/tokenize.ts:22` `MIN_BIGRAM_RUN = 2`，:43-47 重叠
   2-gram 切分；:5-8 的注释记录了 unicode61 不切中文、Segmenter 把「卷积」切成「卷|积」的实测原因。
2. **PD-1 不报 `no such column: 1`**：`planQuery` 对非 `[a-z0-9_]` token 加双引号并转义内部引号
   （tokenize.ts:75-76）；回归测试 `test/tokenize.test.ts:55-56` 断言 `planQuery('PD-1').fts === '"pd 1"'`，
   `test/store.test.ts:67-68` 断言真实检索命中。本轮重跑均绿。
3. **单字中文 LIKE 兜底**：`store.ts:140,153,164-165,185-191`（`matchLike` + 取回后二次过滤）；
   测试 `store.test.ts:76-77`（查询「癌」）。
4. **页码来自 PDF 实际页序**：`pdf.ts:43` `pages.push({ page: i + 1, ... })`（i 为 pdf.js 页循环下标，
   跳过的短页不占号）；`import.ts:98` chunk 直接用 `page.page`。
5. **PDF 字节先复制**：`pdf.ts:34-35` `Uint8Array.from(input)` + 0 字节抛
   `PDF 内容是空的（0 字节）`。
6. **幂等**：`store.ts:61` `UNIQUE (doc_key, page_no)`；`import.ts:118,184` 写入前
   `store.removeDocument(...)`。测试覆盖「同一 (docKey,page) 覆盖而非追加」。
7. **锁库读副本 + 排除回收站**：`zotero.ts:76-82` `mkdtempSync` + `copyFileSync`（含 `-wal`/`-shm`）；
   `deletedItems` 过滤出现在 :142（listItems）、:321（附件）、:363（summarize 统计）三处。

## 3. 资源路由（packages/carsi-router）—— 全部通过

1. **无爬虫/cookie/验证码绕过**：本轮重扫全部 `packages/**/*.ts`，
   `cookie|authorization|sci-hub|proxy_pass|bypass|captcha` **0 命中**。
2. **CARSI 只做身份+深链、不承诺免费**：`src/data/carsi-resources.ts:24` 明文
   「不同学校、不同时间可能不一致——答复用户时请勿承诺『一定免费』，以门户实时状态为准」；
   17 条资源逐条带 note 与 verified 标记。
3. **Unpaywall 缺 email 是 warning 不是崩溃**：`availability.ts:118-119` 跳过并 push warning；
   测试 `availability.test.ts` 覆盖。
4. **三源全失败给 doi.org 兜底**：`availability.ts:227-229` `kind:'library'` +
   `https://doi.org/${doi}` + `needsSubscription:true`；测试覆盖「三路全失败降级」。
5. **四库检索式可直接粘贴**：PubMed `[Title/Abstract]`/`[pt]`/`[Date - Publication]`、WoS `TS=`/`PY=`、
   CNKI `SU=` + `*`/`+`、EuropePMC `PUB_YEAR:[a TO b]` —— `search-formula.test.ts` 8 例逐库断言，本轮重跑全绿。

## 4. 职业规划（packages/career）—— 全部通过

1. **未复制 Career-Planning（License NONE）代码/数据**：全仓扫描 `hankwang|Career-Planning|81296|3600 条`
   仅命中 `src/index.ts:7` 的**否定声明注释**（「不复制第三方职业规划项目…」）；岗位数据是自写的
   12 条画像，无第三方数据集文件。
2. **无 MBTI 等注册商标测评**：代码/数据 0 命中；仅 README:147 与 COMPLIANCE:53 的商标免责声明提及。
3. **技能差距只承认带证据的技能**：`skill-gap.ts:72-75` —— `evidence` 非空才算达标，
   达标但无证据进 `unverified` 清单。
4. **按毕业去向分叉**：`plan.ts:91,112,121-125,132-134,145-149,156-158` 对
   考研/保研/出国/就业逐段分叉（大三节奏、大四上主战场、大四下收尾各不相同）。
5. **来源标注**：`data/occupations.ts:8-14` —— 注明参考 O*NET 公开条目（CC BY 4.0）与国内 JD
   常见要求**改写**、非数据副本、不声称数值一致，并提示「当初稿而不是标准答案」。

## 5. 热点论文（packages/paper-radar）—— 3 通过，1 不通过（已修复）

1. **AIHOT 配置键白名单** ✅：`feed.ts:48-55` 仅 9 个文档内键；测试逐键断言
   `Object.keys(config)` ⊆ 白名单（radar.test.ts:182-200）。
2. **feed 形状** ✅：`data.items` + `published_at`（下划线）+ 带时区 ISO（feed.ts:24,53；测试 :174-180）。
3. **单源失败仅 warning** ✅：`radar.ts:52,62` `Promise.allSettled` + `${label} 抓取失败：…`；测试 :140-148。
4. **DOI 去重保留长摘要** ❌→✅（本轮唯一不通过项，**评审发现的真 bug**）：
   - 旧实现（radar.ts:86-103）里，当**后出现**的重复条目摘要更长而胜出时，胜者只进了 `byDoi`、
     从未进 `byId`，而末尾 `[...byId.values()].filter(keep.has…)` 会同时丢掉胜者与败者 ——
     **该论文从结果里无声消失**。
   - 复现：新增回归测试（arXiv 短摘要 + bioRxiv 同 DOI 长摘要），修复前运行结果
     `AssertionError: expected [] to have a length of 1 but got +0`（实锤，非推测）。
   - 修复：胜者写入 `byDoi` 的同时 `byId.delete(existing.id)` 并补 `byId.set(winner.id, winner)`。
   - 修复后 paper-radar 11/11 绿，全仓 154 绿。
   - 触发概率评估：现有源组合里 PubMed 摘要恒为空串（`sources/pubmed.ts:102`，esummary 不带摘要），
     因此最常见重复对（bioRxiv×PubMed）不会触发；可触发路径是 arXiv 条目的 `arxiv:doi`
     与 bioRxiv DOI 相同且后者摘要更长。低概率、静默数据丢失，定性为**中等严重度**。
   - 顺带修正 :85 的过期注释（「保留最新」→ 实际语义「同 id 保留先出现的」）。

## 6. 科研数据（packages/bio-data）—— 全部通过

1. **只检索+深链**：无任何下载/镜像代码；`cngbdb.ts:4-5` 注释明确「不抓页面，只给深链」。
2. **GEO 只留 GSE 级**：`geo.ts:17` `!/^GSE\d+$/.test(accession) → continue`，并有「N 条命中不是
   数据集级别」warning；测试覆盖。
3. **CNGB/CNSA/GSA 只给门户深链**：`cngbdb.ts:33-43`，关键词 `encodeURIComponent`；测试覆盖。

## 7. 插件接线（packages/learning-tools）—— 全部通过

1. **零 `@deepseek-ai/*` import**：src/test 全扫描仅命中 2 处**注释**（index.ts:7、types.ts:1），
   无 import 语句 —— 与「Loader 从 profile 根解析、官方包在 asar 里拿不到」的约束一致。
2. **output.schema 只用受支持关键字**：14 个工具统一 `schema: OBJECT`；全部工具文件里出现的
   JSON Schema 关键字仅 `type/properties/required/items/enum/additionalProperties`，
   `anyOf|$ref|patternProperties|format` 等 0 命中。
3. **`inject = ['tools']`**：`index.ts:21`。
4. **14 个工具与 README 一一对应**：代码提取 14 个 `study_*` 名与 README 表格 `Compare-Object`
   差集为空。

## 8. 交付与合规 —— 通过（1 项留待用户人工验证）

1. **LICENSE**：Apache-2.0 全文（11358 字节）。
2. **COMPLIANCE 六条硬性禁止**：:18-23 逐条在场（不绕访问控制/不做订阅库爬虫/不做批量下载/
   不重分发全文/不伪造数据/不代写），与代码行为一致（见 §3.1、§6.1 扫描）。
3. **README 快速开始可复现**：本轮在 `%TEMP%\dsh-learning-fresh` 重新 `git clone` +
   `pnpm install --frozen-lockfile`(EXIT 0) + `pnpm check`(EXIT 0, 153→修复后 154) +
   `node scripts/demo.mjs`(EXIT 0)。
4. **CHANGELOG 已知限制真实**：arXiv 不可达（本机实测 `fetch failed`）、扫描件需 OCR、
   CARSI 层级不可自动校验，均与代码行为/演示输出一致。
5. ⚠️ **无法在本环境验证**：「GUI 新建会话选中『知航』预设 + 14 个 `study_*` 工具真实出现」
   —— 需要用户在 DSH 界面操作（会话工具集在会话启动时固定）。这是 v0.1.0 发布前
   唯一待人工确认项。

## 9. 五个挑刺点的回应

1. **二元组误命中**：≥2 字中文查询的短语匹配在数学上等价于**子串匹配**（连续二元组链 ⇔ 原文子串），
   所以「看起来命中、其实不相关」只发生在真子串巧合（如查「物信息」命中「动物信息素」）——
   与 LIKE 语义同级，且 snippet 会给出上下文供人判断；relaxed 命中而原词不在文中时，
   `makeSnippet` 用二元组 anchors 只定位窗口、不加方括号（tokenize.ts / store.ts:144-147），
   不会伪造「原词出现」的假象。**结论：可接受，属方案的固有语义而非实现错误。**
2. **relaxed OR 噪声**：`store.ts:168` 只有 strict 命中数 `< limit` 时才补 relaxed，且 `seen`
   集合保证 strict 命中永远排在前面 —— 噪声只能填尾部空位，不会淹没精确命中；单查询词时
   `relaxed === fts` 被跳过（tokenize.test.ts:60 断言）。**结论：设计合理。**
3. **四年计划同年目标冲突**：逐段核对 plan.ts —— 考研/保研/就业/出国分支互斥，无「同时秋招+初试」
   类矛盾；「未过线立刻启动调剂或春招」是条件分支不是并行目标。存在的张力是**工作量级**的
   （如考研大四上=初试+毕设开题），属现实节奏而非逻辑冲突，且文本自带「选题尽量与目标岗位技能
   重叠，别两张皮」的减负指引。**结论：未发现冲突。**
4. **learning-tools 挂 profile 顶层是否越权**：不是——装进 profile 顶层是用户显式执行
   `install_bundle` 的结果，语义即「本机全局工具」；`cordis.patch.yml` 注释与
   `docs/integration.md` 都写明了「只想给知航用时把这行搬进预设 plugins」的第二种接线。
   **结论：两种接线都有文档，默认选择合理；发布时在 README 安装节再强调一次即可。**
5. **200 篇 PDF 无基准测试**：属实，v0.1.0 没有耗时/内存基准。**记入 v0.2 待办**：
   建议加 `scripts/bench-index.mjs`（N 篇真实 PDF、报告 pages/s 与 RSS 峰值）并在 CI 用
   合成语料做冒烟级性能回归（阈值放宽避免 flaky）。

## 遗留与建议（不阻塞 v0.1.0）

- [ ] **用户人工验证**：GUI 新会话选「知航 · AI 伴学助手」预设，确认加载成功、14 个 `study_*` 工具可用。
- [ ] GitHub 远端创建后 `git remote add origin <url> && git push -u origin main --tags`。
- [ ] v0.2 待办：索引性能基准（§9.5）、`itemAnnotations` 高亮/批注入库、arXiv 关键词检索可选化。
- [ ] 因评审修复发生在打 tag 之后且远端尚未发布，`v0.1.0` tag 已**前移**到包含修复的提交
      （未推送过的 tag 才可以这样处理；发布后必须走 v0.1.1）。
