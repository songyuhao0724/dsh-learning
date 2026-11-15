/**
 * 内置的 CARSI 资源目录（种子）。
 *
 * 来源：CARSI 应用资源门户（北京大学计算中心运营）在**康复大学**身份下的可见条目，
 * 采集于 2026-11-15。门户共 96 条（校购 16 / 免费 14 / 试用 55 / 免费或试用 13），
 * 这里只收录**能逐条复述、可被社区复核**的 17 条；其余条目等有把握时再补。
 *
 * 收录原则：
 * 1. 不猜 URL。拿不到官方入口就留 `url` 为空，让用户从门户里点。
 * 2. 不写「试用即将到期」之类会过期的营销话术，只写入口形态与需要个人账号与否。
 * 3. 新增条目请附出处（PR 描述里贴截图/官方页面链接）。
 */
import type { CatalogMeta, LibraryResource } from '../types.js';

export const CATALOG_META: CatalogMeta = {
  collectedOn: '2026-11-15',
  portal: 'CARSI 应用资源门户（北京大学计算中心运营）',
  institution: '康复大学',
  counts: { total: 96, subscription: 16, free: 14, trial: 55, mixed: 13 },
  note:
    '门户条数按本校当前权限统计，会随学校采购与试用周期变化。本仓库只内置可复核条目，' +
    '不内置「试用」期的临时资源（试用结束后链接必然失效）。' +
    'access 层级依据门户上的「校购/免费/试用」标签记录（门户单校清单页需登录，无法自动校验），' +
    '不同学校、不同时间可能不一致——答复用户时请勿承诺「一定免费」，以门户实时状态为准。',
};

export const CARSI_RESOURCES: LibraryResource[] = [
  {
    id: 'springerlink',
    name: 'SpringerLink',
    provider: 'Springer Nature',
    access: 'subscription',
    category: 'literature',
    coverage: ['英文期刊', '电子书', '计算机', '医学', '生命科学'],
    note: '校购。CARSI 登录后可下载订阅期内期刊与电子书章节。',
    verified: true,
  },
  {
    id: 'nature',
    name: 'Nature',
    provider: 'Springer Nature',
    access: 'subscription',
    category: 'literature',
    coverage: ['顶级期刊', '生命科学', '综述', '新闻'],
    note: '校购。含 Nature 系列期刊，部分子刊可能不在订阅范围。',
    verified: true,
  },
  {
    id: 'web-of-science',
    name: 'Web of Science',
    provider: 'Clarivate',
    access: 'subscription',
    category: 'index',
    coverage: ['引文检索', '影响因子', '被引分析', '文献计量'],
    note: '校购。做文献综述、查被引、找高影响力论文的入口。',
    verified: true,
  },
  {
    id: 'cnki',
    name: '中国知网 CNKI',
    provider: '同方知网',
    access: 'subscription',
    category: 'literature',
    coverage: ['中文期刊', '学位论文', '会议论文', '中文检索'],
    note: '校购。中文文献第一入口；专业检索式语法见 docs 里的检索式生成说明。',
    verified: true,
  },
  {
    id: 'oxford-journals',
    name: 'Oxford Journals',
    provider: 'Oxford University Press',
    access: 'subscription',
    category: 'literature',
    coverage: ['英文期刊', '医学', '生物信息'],
    note: '校购；个人也可单独购买单篇。',
    verified: true,
  },
  {
    id: 'duxiu',
    name: '读秀',
    provider: '超星',
    access: 'subscription',
    category: 'literature',
    coverage: ['中文图书', '图书章节', '教材', '知识库'],
    note: '校购。找教材、专著章节比知网更合用；可按章节传阅。',
    verified: true,
  },
  {
    id: 'cas-jcr',
    name: '中国科学院文献情报中心期刊分区表',
    provider: '中科院文献情报中心',
    access: 'subscription',
    category: 'index',
    coverage: ['期刊分区', '投稿选刊', '影响因子'],
    note: '校购。判断「这本刊值不值得投」的国内常用依据。',
    verified: true,
  },
  {
    id: 'medseek',
    name: 'MedSeek 厚道医学教育大模型',
    provider: '学堂在线',
    access: 'free',
    category: 'ai-tool',
    coverage: ['医学教育', '病例', '医学问答', 'AI 学伴'],
    note: '免费。医学课程学习与病例理解可用。',
    verified: true,
  },
  {
    id: 'mworks',
    name: 'MWORKS',
    provider: '同元软控',
    access: 'free',
    category: 'compute',
    coverage: ['科学计算', '建模仿真', 'Modelica'],
    note: '免费。做系统建模/仿真时可用，替代部分 MATLAB 场景。',
    verified: true,
  },
  {
    id: 'miguo',
    name: '觅果 · AI 智能学伴',
    provider: '觅果',
    access: 'free',
    category: 'ai-tool',
    coverage: ['AI 学伴', '课程问答', '学习计划'],
    note: '免费。适合课程内答疑与复习。',
    verified: true,
  },
  {
    id: 'shangniu-course',
    name: '上纽课',
    provider: '上海纽约大学',
    access: 'free',
    category: 'course',
    coverage: ['通识课程', '英文授课', '公开课'],
    note: '免费。通识与英文授课视频课程。',
    verified: true,
  },
  {
    id: 'oscca-cloud',
    name: '开放科学计算联盟云',
    provider: '开放科学计算联盟',
    access: 'free',
    category: 'compute',
    coverage: ['云计算', '算力', '科学计算环境'],
    note: '免费。需要跑大计算但本机不够时可以先看这里。',
    verified: true,
  },
  {
    id: 'cngbdb',
    name: '国家基因库生命大数据平台 CNGBdb',
    provider: '国家基因库（CNGB）',
    access: 'free',
    category: 'data',
    coverage: ['基因组', '测序数据', '生命大数据', '生物信息'],
    note: '免费；部分数据需申请或付费下载。生信方向找公开数据集的重要入口。',
    verified: true,
  },
  {
    id: 'dde',
    name: '深时数字地球 DDE',
    provider: 'DDE 国际大科学计划',
    access: 'free',
    category: 'data',
    coverage: ['地学数据', '古气候', '空间数据'],
    note: '免费。做地学/环境交叉课题时的数据源。',
    verified: true,
  },
  {
    id: 'cernet-video-course',
    name: '赛尔网络下一代互联网视频课程',
    provider: '赛尔网络 CERNET',
    access: 'free',
    category: 'course',
    coverage: ['网络技术', '视频课程', '公开课'],
    note: '免费。计算机网络与工程类课程。',
    verified: true,
  },
  {
    id: 'patent-platform',
    name: '专利管理运营平台',
    provider: '待核实',
    access: 'free',
    category: 'patent',
    coverage: ['专利检索', '专利分析', '成果转化'],
    note: '免费。查同类专利、看技术空白点用。',
    verified: true,
  },
  {
    id: 'frontiers-cn',
    name: '中国学术前沿期刊网',
    provider: '高等教育出版社',
    access: 'free',
    category: 'literature',
    coverage: ['中文期刊', '前沿综述', '学术前沿'],
    note: '免费。看国内前沿综述比逐篇检索更快建立框架。',
    verified: true,
  },
];