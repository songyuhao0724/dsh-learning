/**
 * 岗位画像（内置种子）。
 *
 * 用例：生物信息/医学信息方向的学生在「我到底能做什么」这一步最缺参照物。
 * 这些画像回答四件事：这岗位一天在干什么、要什么技能到什么程度、
 * 学历门槛与考研方向、从校园怎么进去。
 *
 * 数据来源：RIASEC 权重与任务清单参考 O*NET 公开职业条目（CC BY 4.0）与
 * 国内招聘 JD 的常见要求，由作者改写为中文表述 —— 不是 O*NET 数据的副本，
 * 也不声称数值与 O*NET 一致。招聘市场变化快，请把它当初稿而不是标准答案。
 */
import type { OccupationProfile, SkillLevel } from '../types.js';

const REFERENCE_NOTE =
  '作者依据 O*NET 公开职业描述（CC BY 4.0）与国内招聘 JD 常见要求改写；非原始数据副本，数值不代表 O*NET 官方评分。';

function skill(skillName: string, level: SkillLevel, note?: string) {
  return note === undefined ? { skill: skillName, level } : { skill: skillName, level, note };
}

export const OCCUPATIONS: OccupationProfile[] = [
  {
    id: 'bioinfo-engineer',
    title: '生物信息工程师',
    field: 'bioinformatics',
    oneLiner: '把测序仪吐出来的海量原始数据，变成能解释生物学问题的结果表格和图表。',
    riasec: { R: 4, I: 7, A: 2, S: 2, E: 3, C: 5 },
    skills: [
      skill('Linux 命令行与服务器操作', 3, '能在不图形界面的服务器上跑完一整条流程'),
      skill('Python 编程', 3, '写得出可复用的脚本，不是只会跑别人的代码'),
      skill('R 语言与统计分析', 2),
      skill('NGS 流程（比对/变异检测/表达定量）', 3),
      skill('统计与概率基础', 3),
      skill('Git 版本管理', 2),
      skill('英文文献阅读', 2),
    ],
    tasks: [
      '搭建并维护分析流程（fastp → BWA/STAR → GATK/featureCounts）',
      '处理批次效应、写分析报告、和实验组对结果',
      '把一次性脚本重构成可复用的流程',
      '跑公共数据（GEO/SRA/TCGA）做验证',
    ],
    education: ['本科可入门（技术岗）', '硕士更常见', '考研方向：生物信息学 / 生物医学工程 / 计算机'],
    entry: [
      '先做一个完整的公开数据集分析项目（从下载到出图）',
      '参加 iGEM、挑战杯或实验室横向项目，把流程写进简历',
      '实习优先找测序公司、基因检测公司、医院精准医学中心',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'clinical-data-manager',
    title: '临床数据管理员（CDM）',
    field: 'clinical-research',
    oneLiner: '在临床试验里管数据质量：设计 CRF、清理数据、回答质疑，保证数据能被药监接受。',
    riasec: { R: 2, I: 5, A: 1, S: 4, E: 3, C: 7 },
    skills: [
      skill('临床试验基础知识（GCP）', 3),
      skill('EDC 系统操作（如 Medidata/Veeva）', 2),
      skill('数据核查与质疑管理', 3),
      skill('SAS 或 SQL 数据操作', 2),
      skill('医学编码（MedDRA/WHO Drug）', 2),
      skill('英文文档写作', 2),
    ],
    tasks: [
      '写数据管理计划（DMP）与 CRF 设计',
      '跑数据核查清单，发质疑（query）并跟踪关闭',
      '和统计、医学、监查团队对齐数据口径',
      '支持锁库与数据审核会',
    ],
    education: ['本科可入门', '硕士加分', '考研方向：流行病与卫生统计学 / 公共卫生（MPH）'],
    entry: [
      '先读 ICH-GCP 要点，考一个 GCP 培训证书',
      '熟悉一个 EDC 系统的公开演示环境',
      '实习优先找 CRO 或药企的数据管理部',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'biostatistician',
    title: '生物统计师',
    field: 'clinical-research',
    oneLiner: '决定临床试验要用多少样本、用什么统计方法，最后把结果算成监管能接受的数字。',
    riasec: { R: 1, I: 7, A: 2, S: 2, E: 2, C: 6 },
    skills: [
      skill('数理统计与概率论', 3),
      skill('SAS 编程', 3),
      skill('临床试验统计方法（生存分析/混合模型）', 3),
      skill('样本量计算', 2),
      skill('SAP（统计分析计划）撰写', 2),
      skill('英文文献与法规阅读', 3),
    ],
    tasks: [
      '参与方案设计，写样本量与统计假设',
      '写 SAP、做表格（TLF）模板',
      '和程序员对齐分析数据集（SDTM/ADaM）',
      '回答监管与统计审评的问题',
    ],
    education: ['硕士起步', '博士更常见', '考研方向：统计学 / 流行病与卫生统计学 / 生物统计'],
    entry: [
      '把 R 或 SAS 学到能独立复现一篇论文的统计结果',
      '做一个真实数据（如 NHANES）的分析报告',
      '实习优先找 CRO 统计部或药企生物统计部',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'medical-ai-engineer',
    title: '医疗 AI 算法工程师',
    field: 'bioinformatics',
    oneLiner: '拿医学影像、电子病历或组学数据训练模型，并证明它在临床场景里真的有用。',
    riasec: { R: 4, I: 7, A: 3, S: 2, E: 4, C: 4 },
    skills: [
      skill('Python + PyTorch', 3),
      skill('机器学习与深度学习基础', 3),
      skill('医学数据预处理（影像/文本/表格）', 2),
      skill('模型评估与可解释性', 2),
      skill('论文复现能力', 3),
      skill('工程化与部署（Docker/API）', 2),
    ],
    tasks: [
      '复现论文基线，找到能改进的点',
      '清洗标注数据，处理类别不平衡与数据泄漏',
      '做消融实验与外部验证集',
      '和临床医生确认标签口径与评价指标',
    ],
    education: ['硕士起步', '博士更常见', '考研方向：计算机 / 生物医学工程 / 人工智能'],
    entry: [
      '复现 1 个公开医学数据集上的论文（如 CheXpert/MIMIC）',
      '参加 Kaggle 或天池的医学赛道，拿到可写进简历的名次',
      '开源你的代码与报告，比"熟悉算法"四个字有说服力',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'genomic-analyst',
    title: '基因组数据分析师',
    field: 'health-data',
    oneLiner: '面对一个人的全基因组/全外显子数据，找出与疾病或用药相关的变异并解释它。',
    riasec: { R: 3, I: 7, A: 2, S: 2, E: 2, C: 5 },
    skills: [
      skill('遗传学与基因组学基础', 3),
      skill('变异注释工具（VEP/Annovar）', 3),
      skill('数据库检索（ClinVar/gnomAD/OMIM）', 3),
      skill('Linux + Python/R', 2),
      skill('ACMG 变异评级规范', 2),
      skill('临床遗传报告撰写', 2),
    ],
    tasks: [
      '跑变异检测与注释流程',
      '按 ACMG 指南做变异致病性评级',
      '写报告并与临床医生讨论',
      '维护本地数据库版本',
    ],
    education: ['本科可入门', '硕士更常见', '考研方向：遗传学 / 生物信息学 / 临床检验诊断学'],
    entry: [
      '用公开的三人家系数据（如 1000 Genomes）走完整个分析',
      '读 10 份真实遗传报告，学会写结论',
      '实习优先找基因检测公司或医院遗传咨询门诊',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'health-data-analyst',
    title: '健康数据分析师',
    field: 'health-data',
    oneLiner: '把医院 HIS/医保/公卫数据整理成指标，回答「哪种干预更省钱、更有效」这类问题。',
    riasec: { R: 2, I: 6, A: 2, S: 3, E: 3, C: 5 },
    skills: [
      skill('SQL 数据查询', 3),
      skill('Python/R 数据清洗与可视化', 3),
      skill('描述统计与基本推断', 2),
      skill('医疗卫生指标体系', 2),
      skill('Excel/BI 看板', 2),
      skill('报告写作与口头汇报', 3),
    ],
    tasks: [
      '写 SQL 取数，核对口径',
      '做看板与月度分析报告',
      '支持临床科室与管理部门的决策问题',
      '处理缺失值、异常值与重复就诊',
    ],
    education: ['本科可入门', '硕士加分', '考研方向：公共卫生 / 卫生事业管理 / 流行病与卫生统计学'],
    entry: [
      '用一个公开医保/公卫数据集做一份 10 页分析报告',
      '把 SQL 练到能独立写多表关联与窗口函数',
      '实习优先找医院信息科、卫健委、医疗大数据公司',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'precision-medicine-researcher',
    title: '精准医疗研究员',
    field: 'academic',
    oneLiner: '研究「为什么同样的药对不同人效果不一样」，把组学数据变成可临床落地的标志物。',
    riasec: { R: 2, I: 7, A: 3, S: 3, E: 3, C: 4 },
    skills: [
      skill('分子生物学实验基础', 3),
      skill('多组学数据分析（转录组/蛋白组/代谢组）', 3),
      skill('统计建模与机器学习', 2),
      skill('科研论文写作', 3),
      skill('基金/项目申请书撰写', 1),
      skill('英文科技交流', 3),
    ],
    tasks: [
      '设计队列与实验，控制混杂因素',
      '做多组学整合分析，找候选标志物',
      '写论文、投稿、回复审稿意见',
      '和临床科室合作做验证',
    ],
    education: ['博士为主', '硕士可做研究助理', '考研方向：生物化学与分子生物学 / 细胞生物学 / 生物信息学'],
    entry: [
      '大二就进实验室，跟完一个课题从设计到投稿',
      '争取一作或共一，哪怕是小期刊',
      '学会用 Zotero + 文献综述把领域地图画出来',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'pharma-data-scientist',
    title: '医药研发数据科学家',
    field: 'pharma',
    oneLiner: '在药物发现/临床开发链条里做数据建模：靶点评估、试验设计、真实世界证据。',
    riasec: { R: 2, I: 7, A: 2, S: 2, E: 4, C: 5 },
    skills: [
      skill('统计与机器学习', 3),
      skill('Python / R 工程化代码', 3),
      skill('药物研发流程基础知识', 2),
      skill('真实世界数据（RWD）分析', 2),
      skill('数据可视化与汇报', 2),
      skill('英文沟通', 3),
    ],
    tasks: [
      '清洗与整合多来源临床/真实世界数据',
      '建预测模型（疗效、安全性、患者分层）',
      '写分析方案与结果报告',
      '和医学、统计、注册团队协作',
    ],
    education: ['硕士起步', '博士加分', '考研方向：生物统计 / 药学（临床药学）/ 计算机'],
    entry: [
      '做一个 RWD 公开数据（如 MIMIC-IV）的完整分析',
      '把机器学习课的项目改成「医药问题 + 可解释模型」',
      '实习优先找药企数字化部门或 CRO',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'medical-informatics-product',
    title: '医疗信息产品经理',
    field: 'product',
    oneLiner: '在「医生怎么用」和「工程师怎么实现」之间做翻译，决定产品做什么、不做什么。',
    riasec: { R: 1, I: 4, A: 4, S: 6, E: 6, C: 4 },
    skills: [
      skill('需求调研与用户访谈', 3),
      skill('产品原型（Figma 等）', 2),
      skill('医疗业务与合规常识（数据安全/隐私）', 2),
      skill('数据分析与指标设计', 2),
      skill('项目管理与跨部门沟通', 3),
      skill('AI 能力边界的基本判断', 2),
    ],
    tasks: [
      '访谈医生，写成可执行的需求文档',
      '画流程图与原型，和开发对齐边界',
      '定义验收标准，跟进上线',
      '处理合规与数据安全问题',
    ],
    education: ['本科可入门', '硕士加分', '考研方向：公共卫生 / 管理科学与工程 / 医学信息学'],
    entry: [
      '做一个校园项目/比赛，完整走一遍「需求→原型→上线→复盘」',
      '去医院信息科或医疗 IT 公司实习，看真实工作流',
      '学会写一页纸需求文档，而不是只会说"我觉得"',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'academic-research-assistant',
    title: '科研助理（实验室数据分析）',
    field: 'academic',
    oneLiner: '帮课题组把数据跑出来、图做出来、材料写出来，是读研前最好的过渡岗位。',
    riasec: { R: 3, I: 6, A: 3, S: 3, E: 2, C: 5 },
    skills: [
      skill('Linux 与脚本编程', 2),
      skill('常用分析软件（SPSS/R/GraphPad）', 2),
      skill('实验记录与数据管理规范', 3),
      skill('文献检索与综述整理', 3),
      skill('英文读写', 3),
    ],
    tasks: [
      '按课题要求跑分析、出图、写方法部分',
      '维护数据与代码的可复现性',
      '协助写基金结题材料与论文',
      '带本科生做实验/分析',
    ],
    education: ['本科即可', '常作为读研跳板', '考研方向：与实验室方向一致'],
    entry: [
      '主动找本校老师，带着「我能做什么」而不是「我想学什么」',
      '把一门课的大作业做成可展示的项目',
      '争取在组会上讲一次文献',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'science-editor',
    title: '医学编辑 / 学术写作',
    field: 'communication',
    oneLiner: '把科研结果翻译成人能读懂的文本：投稿润色、指南解读、科普与医学传播。',
    riasec: { R: 0, I: 4, A: 5, S: 4, E: 3, C: 5 },
    skills: [
      skill('中英文写作', 3),
      skill('医学/生命科学知识面', 2),
      skill('文献检索与事实核查', 3),
      skill('编辑规范（参考文献格式/术语）', 2),
      skill('沟通与项目管理', 2),
    ],
    tasks: [
      '润色论文、检查逻辑与格式',
      '写指南解读、会议报道、科普稿',
      '和作者/专家沟通修改',
      '做事实核查，避免夸大结论',
    ],
    education: ['本科可入门', '硕士加分', '考研方向：医学人文 / 新闻传播 / 公共卫生'],
    entry: [
      '持续写一个科普/学术解读专栏，攒 10 篇作品',
      '学会用 EndNote/Zotero 管参考文献',
      '实习优先找医学出版社、学术媒体、药企医学部',
    ],
    sources: REFERENCE_NOTE,
  },
  {
    id: 'genetic-counselor',
    title: '遗传咨询师',
    field: 'clinical-research',
    oneLiner: '把基因检测结果讲给患者和家属听：风险有多大、下一步做什么、生育怎么选。',
    riasec: { R: 1, I: 5, A: 4, S: 7, E: 4, C: 4 },
    skills: [
      skill('医学遗传学', 3),
      skill('遗传检测技术与报告解读', 3),
      skill('沟通与共情能力', 3),
      skill('伦理与隐私规范', 3),
      skill('家系分析与风险评估', 2),
      skill('英文文献阅读', 2),
    ],
    tasks: [
      '采集家系史，评估遗传风险',
      '解释检测结果与不确定性',
      '写咨询记录并做随访',
      '参与多学科会诊',
    ],
    education: ['硕士起步', '国内岗位较少但需求在增长', '考研方向：医学遗传学 / 遗传咨询方向'],
    entry: [
      '去医院遗传门诊旁听/见习（先问清伦理与隐私要求）',
      '读 ACMG 指南与真实案例',
      '训练把专业术语翻译成家属听得懂的话',
    ],
    sources: REFERENCE_NOTE,
  },
];

export function findOccupation(id: string): OccupationProfile | undefined {
  return OCCUPATIONS.find((occupation) => occupation.id === id);
}