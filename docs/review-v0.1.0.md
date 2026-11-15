# v0.1.0 异构评审清单

这份清单是给**另一个模型**（不是写代码的那个）用的：里面每一条都是可证伪的断言，
请逐条核对并给出「通过 / 不通过 / 无法验证」，不要因为代码写得漂亮就给分。

## 0. 环境

```
仓库：C:\Users\songy\dev\dsh-learning   （git tag v0.1.0，分支 main）
运行：Node >= 22.13、pnpm 11.28.5
命令：pnpm install --frozen-lockfile && pnpm check && node scripts/demo.mjs
```

`pnpm check` = `validate:preset → build → typecheck → test`。预期：153 个测试全绿。

## 1. 预设（packages/preset-zhihang）

- [ ] `cordis.patch.yml` 只有 1 行 insert，行 id 唯一，`@deepseek-ai/dsh-persona` 的 `prefix` 非空。
- [ ] plan-mode 的 `config.section` 存在且非空字符串 —— **这是真踩过的坑**：DSH 的
      `dsh-plan-mode` 对它做 `typeof !== 'string'` 直接抛错，缺了会「装得上、一选中就炸」。
      验证：`node -e "const m=require('.../dsh-plan-mode')"` 不行，直接看
      `resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-plan-mode/lib/index.js` 里
      `PlanModeConfig needs a string \`section\`` 那段，确认字段名与校验规则。
- [ ] persona 文本没有假设用户身份（不写死姓名/学校/年级），而是「先找工作区档案，没有就 6 问建档」。
- [ ] 工具集与官方 standard 预设等价（少一个都算降级），且 `plugin-manager` 行有
      `disabled: !!js "!ctx.get('profileContext')"`（否则在非 profile 环境会炸）。

## 2. 检索质量（packages/scholar）

- [ ] 中文检索用「重叠二元组 + FTS5 短语匹配」，不是 `unicode61`、不是 `Intl.Segmenter`。
      理由可查：`tokenize.ts` 的 `MIN_BIGRAM_RUN`、`planQuery` 的短语拼接。
- [ ] `PD-1` 这类带连字符的查询**不会**报 `no such column: 1`（FTS5 把 `-` 当列过滤语法，
      必须在 `planQuery` 里给 token 加双引号）。
- [ ] 单字中文（如「癌」）有 LIKE 兜底，不是 0 命中。
- [ ] 命中结果带**页码**，且页码来自 PDF 实际页序（不是 chunk 序号）。
- [ ] PDF 字节在传给 pdf.js 前被复制（`Uint8Array.from`），否则第二次使用会
      `DataCloneError: Cannot transfer object of unsupported type`。
- [ ] 索引幂等：同一篇重跑不会重复累积（`UNIQUE(doc_key, page_no)` + 先删后写）。
- [ ] Zotero 库被 Zotero 占用时读副本，不写原库；`deletedItems` 里的条目不被统计。

## 3. 资源路由（packages/carsi-router）

- [ ] 没有写任何订阅库的爬虫、没有存 cookie、没有绕验证码：全仓 `grep -i "cookie|captcha|bypass"`
      应无命中（我自己跑过是 0）。
- [ ] CARSI 只做「身份 + 深链」：`CARSI_RESOURCES` 的 17 条都能指回门户标签，
      且**话术不承诺一定免费**（`CATALOG_META.note` 有说明）。
- [ ] Unpaywall 需要 email 才有结果（缺 email 时是 warning 跳过，不是 422 崩掉）。
- [ ] 三个开放获取源都失败时，仍给出 `https://doi.org/<doi>` 兜底 + 指向学校资源，而不是抛错。
- [ ] 检索式对四个库都**可以直接粘贴使用**（PubMed 的 `[Title/Abstract]`、WoS 的 `TS=`、
      CNKI 的 `SU=` + `*`/`+`、EuropePMC 的 `PUB_YEAR:[a TO b]`）。

## 4. 职业规划（packages/career）

- [ ] 没有复制 `github.com/hankwang712/Career-Planning` 的代码或数据（它 License 是 NONE）。
      仓库里不含 81,296 条岗位数据、不含 3,600 条分类知识。
- [ ] 不出现「MBTI」等注册商标名的测评（只保留公共领域的霍兰德 RIASEC）。
- [ ] 技能差距只承认**带证据**的技能：达标但没证据的进「未验证」，不算达标。
- [ ] 四年计划按毕业去向（考研/保研/就业/出国）分叉，不是一份通用模板套四种。
- [ ] 岗位画像标注了来源（O*NET CC BY 4.0 改写，非原始数据副本）。

## 5. 热点论文（packages/paper-radar）

- [ ] AIHOT 信源配置**只用文档里出现过的键**（`url / mode / itemsPath / titlePaths /
      summaryPaths / urlTemplate / publishedAtPath / externalIdPath / authorPaths`），
      多写一个未知键 AIHOT 会拒绝整份配置。
- [ ] 产出 JSON 的形状是 `{"data":{"items":[...]}}`，字段名是 `published_at`（下划线，不是驼峰）。
- [ ] 单源失败（本机 arXiv 就抓不到）只产生一条 warning，不影响其他源。
- [ ] 按 DOI 去重时保留摘要更长的那个，而不是随便留一条。

## 6. 科研数据（packages/bio-data）

- [ ] 只做「检索 + 深链」，不下载、不镜像、不重分发原始数据。
- [ ] GEO 结果只保留 `GSE` 级（gds 库的 GPL/GDS 命中会混进来，必须过滤）。
- [ ] CNGBdb / CNSA / GSA 只给网页入口（它们的检索接口需要申请），不抓页面。

## 7. DSH 插件接线（packages/learning-tools）

- [ ] 工具定义是**普通对象**，没有 `import '@deepseek-ai/*'` —— 因为官方包装在
      `resources/app.asar` 里，link 安装的插件从 profile 根解析不到它们。
- [ ] 每个工具都声明了 `output: { schema, render }`，且 schema 只用 DSH 支持的
      关键字（type/oneOf/properties/required/additionalProperties/items/enum/const）。
- [ ] `inject: ['tools']`（写错的后果是插件永不激活，且没有任何报错）。
- [ ] 14 个工具名与 README 的工具表一一对应，没有多也没有少。

## 8. 交付与合规

- [ ] `LICENSE` 是 Apache-2.0 全文；`COMPLIANCE.md` 的六条硬禁止与代码一致。
- [ ] `README.md` 的快速开始能让陌生人一次装通（已在全新目录 clone + `pnpm install
      --frozen-lockfile` + `pnpm check` + `demo` 验证过，但请你自己再走一遍）。
- [ ] `CHANGELOG.md` 的「已知限制」没有藏真问题（arXiv 不可达、扫描件需 OCR、
      CARSI 层级不可自动校验这几条是真的）。

## 9. 请特别挑刺的地方

1. 中文二元组方案的**误命中**：`makeSnippet` 用原始词加方括号、二元组只用来定位窗口，
   这个折中会不会在某些查询下给出「看起来命中、其实不相关」的片段？
2. `planQuery` 的 `relaxed`（全部 token OR）在长查询下会不会把噪声放大到淹没精确命中？
3. 四年计划里「每年目标从岗位技能派生」—— 会不会在同一年里给出互相冲突的目标？
4. 如果用户同时装了两个预设（知航 + 别的），`learning-tools` 挂在 profile 顶层会让工具
   出现在所有预设里，这是否越权？
5. `study_papers_index` 对 200 篇 PDF 的耗时与内存占用没有基准测试 —— 是不是该加一个？