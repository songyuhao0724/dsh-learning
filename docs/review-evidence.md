# v0.1.0 证据记录（自动捕获）

捕获时间：2026-11-15 19:33:29 +08:00
捕获机器：Windows / Node v24.21.0 / pnpm 11.28.5

下面三段是 `scripts/demo.mjs` 的**原样输出**（不是复述）。评审时请自己重跑一遍对照，
如果不一致，以你的重跑结果为准。

## 1. 离线演示（`node scripts/demo.mjs`）

```
=== scholar · 建索引 + 带页码检索 ===
索引：2 页 → C:\Users\songy\dev\dsh-learning\.demo\demo-index.db
检索「rehabilitation robotics」：1 条 → 第 1 页
  [Rehabilitation] [robotics] helps stroke survivors recover.
检索「genomic」：1 条 → 第 2 页
  [Genomic] analysis of lung cancer cohorts needs careful design.
检索「lung cancer」：1 条 → 第 2 页
  Genomic analysis of [lung] [cancer] cohorts needs careful design.
库统计：2 个块 / 1 篇

=== carsi-router · 资源画像 + 检索式 ===
资源 17 条：校购 7 / 免费 10 / 试用 0
- 中国知网 CNKI（同方知网）
- 读秀（超星）
("脑卒中"[Title/Abstract] OR "深度学习"[Title/Abstract]) AND (2020/01/01[Date - Publication] : 2020/12/31[Date - Publication]) AND (review[pt])

=== career · RIASEC → 岗位匹配 → 四年计划 ===
兴趣前三码：ICR —— I（研究型（分析/推理/实验））、C（常规型（数据/流程/规范））、R（实用型（动手/工具/设备））
最匹配：生物统计师（100.0 分）
最需要补的 3 项：
- 临床试验统计方法（生存分析/混合模型）：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 临床试验统计方法（生存分析/混合模型），并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 数理统计与概率论：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 数理统计与概率论，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 英文文献与法规阅读：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 英文文献与法规阅读，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 大一（2026–2027）：绩点不掉队（专业前 30% 以内），为保研/考研/出国留出选择权。；掌握 1 门编程语言的基础语法与调试方法。
- 大二（2027–2028）：把 数理统计与概率论 练到"能独立完成一次分析"的程度。；完成 1 个完整项目并留下可运行代码与报告。
- 大三（2028–2029）：把 SAS 编程 推到能对外展示的水平。；考研/保研准备进入系统化阶段，有明确的月度进度表。
- 大四（2029–2030）：初试过线并完成复试/调剂，拿到录取或明确下一步。；毕设与作品集完成，能支撑一次 30 分钟的深度面试。

=== paper-radar / bio-data ===
跳过联网模块（加 --online 才会跑；arXiv 在部分校园网不可达，只会变成一条 warning）。

全部模块跑完。
```

## 2. 联网演示（`node scripts/demo.mjs --online`）

```
=== scholar · 建索引 + 带页码检索 ===
索引：2 页 → C:\Users\songy\dev\dsh-learning\.demo\demo-index.db
检索「rehabilitation robotics」：1 条 → 第 1 页
  [Rehabilitation] [robotics] helps stroke survivors recover.
检索「genomic」：1 条 → 第 2 页
  [Genomic] analysis of lung cancer cohorts needs careful design.
检索「lung cancer」：1 条 → 第 2 页
  Genomic analysis of [lung] [cancer] cohorts needs careful design.
库统计：2 个块 / 1 篇

=== carsi-router · 资源画像 + 检索式 ===
资源 17 条：校购 7 / 免费 10 / 试用 0
- 中国知网 CNKI（同方知网）
- 读秀（超星）
("脑卒中"[Title/Abstract] OR "深度学习"[Title/Abstract]) AND (2020/01/01[Date - Publication] : 2020/12/31[Date - Publication]) AND (review[pt])

=== career · RIASEC → 岗位匹配 → 四年计划 ===
兴趣前三码：ICR —— I（研究型（分析/推理/实验））、C（常规型（数据/流程/规范））、R（实用型（动手/工具/设备））
最匹配：生物统计师（100.0 分）
最需要补的 3 项：
- 临床试验统计方法（生存分析/混合模型）：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 临床试验统计方法（生存分析/混合模型），并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 数理统计与概率论：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 数理统计与概率论，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 英文文献与法规阅读：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 英文文献与法规阅读，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 大一（2026–2027）：绩点不掉队（专业前 30% 以内），为保研/考研/出国留出选择权。；掌握 1 门编程语言的基础语法与调试方法。
- 大二（2027–2028）：把 数理统计与概率论 练到"能独立完成一次分析"的程度。；完成 1 个完整项目并留下可运行代码与报告。
- 大三（2028–2029）：把 SAS 编程 推到能对外展示的水平。；考研/保研准备进入系统化阶段，有明确的月度进度表。
- 大四（2029–2030）：初试过线并完成复试/调剂，拿到录取或明确下一步。；毕设与作品集完成，能支撑一次 30 分钟的深度面试。

=== paper-radar · 最近 3 天热点（网络） ===
抓到 6 篇；来源 {"arXiv":0,"bioRxiv":3,"medRxiv":3}
注意：arXiv 抓取失败：fetch failed
- [biorxiv] Readout adaptation in simulated arm reaching: learned compen
- [biorxiv] An expanded structural and biochemical map of GLI-SUFU recog
- [biorxiv] Metabolic exploitation of the bacterial arginine deiminase p
AIHOT 信源键：url, mode, itemsPath, titlePaths, summaryPaths, urlTemplate, publishedAtPath, externalIdPath, authorPaths

=== bio-data · GEO 检索（网络） ===
命中共 10827 条，取 2 条
- GSE349653｜IgD-secreting plasma cells in lung cancer reveal a｜Homo sapiens｜12 样本
- GSE303413｜Multi-lineage evolution of drug resistance via a k｜Homo sapiens｜18 样本
- 国家基因库生命大数据平台（CNGBdb）：https://db.cngb.org/search/?q=%E5%8D%95%E7%BB%86%E8%83%9E%20%E8%82%BA%E7%99%8C
- CNGB 序列归档库（CNSA）：https://db.cngb.org/search/?q=%E5%8D%95%E7%BB%86%E8%83%9E%20%E8%82%BA%E7%99%8C
- 国家基因组科学数据中心 GSA：https://ngdc.cncb.ac.cn/gsa/search?searchTerm=%E5%8D%95%E7%BB%86%E8%83%9E%20%E8%82%BA%E7%99%8C

全部模块跑完。
```

## 3. 真实中文 PDF（`node scripts/demo.mjs --pdf <职业生涯规划.pdf>`）

```
=== scholar · 建索引 + 带页码检索 ===
索引：12 页 → C:\Users\songy\dev\dsh-learning\.demo\demo-index.db
检索「基因组」：2 条 → 第 7、5 页
  … · 大学阶段：夯实专业基础与生信技能，全力备战考研，成功上岸。 ▪ 中期 · 读研阶段（约 3 年）：深耕一个方向（如[基因组]学分析 / 医学人工智能），
检索「康复机器人」：3 条 → 第 9、6、1 页
  …路径 课程、自学、证书、实践四线并进 宋宇昊 · 大学生职业生涯规划 9 ▪ 课程体系：生物信息学、分子生物学、统计学、机器学习与数据挖掘。 ▪ 自主修炼： 
检索「lung cancer」：0 条
库统计：12 个块 / 1 篇

=== carsi-router · 资源画像 + 检索式 ===
资源 17 条：校购 7 / 免费 10 / 试用 0
- 中国知网 CNKI（同方知网）
- 读秀（超星）
("脑卒中"[Title/Abstract] OR "深度学习"[Title/Abstract]) AND (2020/01/01[Date - Publication] : 2020/12/31[Date - Publication]) AND (review[pt])

=== career · RIASEC → 岗位匹配 → 四年计划 ===
兴趣前三码：ICR —— I（研究型（分析/推理/实验））、C（常规型（数据/流程/规范））、R（实用型（动手/工具/设备））
最匹配：生物统计师（100.0 分）
最需要补的 3 项：
- 临床试验统计方法（生存分析/混合模型）：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 临床试验统计方法（生存分析/混合模型），并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 数理统计与概率论：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 数理统计与概率论，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 英文文献与法规阅读：岗位要求 能独立负责并讲清楚，你目前 没接触过。先系统学一遍 英文文献与法规阅读，并产出一个能演示的结果（报告/仓库/演示视频），不要只停留在看课。
- 大一（2026–2027）：绩点不掉队（专业前 30% 以内），为保研/考研/出国留出选择权。；掌握 1 门编程语言的基础语法与调试方法。
- 大二（2027–2028）：把 数理统计与概率论 练到"能独立完成一次分析"的程度。；完成 1 个完整项目并留下可运行代码与报告。
- 大三（2028–2029）：把 SAS 编程 推到能对外展示的水平。；考研/保研准备进入系统化阶段，有明确的月度进度表。
- 大四（2029–2030）：初试过线并完成复试/调剂，拿到录取或明确下一步。；毕设与作品集完成，能支撑一次 30 分钟的深度面试。

=== paper-radar / bio-data ===
跳过联网模块（加 --online 才会跑；arXiv 在部分校园网不可达，只会变成一条 warning）。

全部模块跑完。
```

## 4. `pnpm check` 摘要

```
✓ packages\learning-tools\cordis.patch.yml —— 1 行 insert，1 个顶层 id
✓ packages\preset-zhihang\cordis.patch.yml —— 1 行 insert，1 个顶层 id
packages/bio-data test:       Tests  10 passed (10)
packages/carsi-router test:       Tests  23 passed (23)
packages/career test:       Tests  36 passed (36)
packages/paper-radar test:       Tests  10 passed (10)
packages/scholar test:       Tests  63 passed (63)
packages/learning-tools test:       Tests  11 passed (11)
```