/**
 * 招聘 JD 解析（纯规则，不调模型）。
 *
 * 为什么不用大模型：学生手上常常只有一段 JD 文本，想要的是「把要求拆成清单」。
 * 规则解析可离线、可测试、结果稳定；大模型适合在此基础上做取舍判断。
 */
import type { ParsedJd } from './types.js';

interface SkillEntry {
  skill: string;
  aliases: string[];
}

/** 技能词典：skill 是规范名，aliases 是 JD 里常见的写法。 */
export const SKILL_LEXICON: SkillEntry[] = [
  { skill: 'Python', aliases: ['python'] },
  { skill: 'R 语言', aliases: ['r语言', ' r语言', 'rstudio', '使用 r '] },
  { skill: 'SQL', aliases: ['sql'] },
  { skill: 'Linux', aliases: ['linux', 'shell', 'bash'] },
  { skill: 'SAS', aliases: ['sas'] },
  { skill: 'SPSS', aliases: ['spss'] },
  { skill: 'C/C++', aliases: ['c++', 'c语言'] },
  { skill: 'Java', aliases: ['java'] },
  { skill: 'PyTorch', aliases: ['pytorch', 'torch'] },
  { skill: 'TensorFlow', aliases: ['tensorflow'] },
  { skill: 'scikit-learn', aliases: ['scikit-learn', 'sklearn'] },
  { skill: '机器学习', aliases: ['机器学习', 'machine learning'] },
  { skill: '深度学习', aliases: ['深度学习', 'deep learning', '神经网络'] },
  { skill: '自然语言处理', aliases: ['自然语言处理', 'nlp'] },
  { skill: '医学影像', aliases: ['医学影像', '影像组学'] },
  { skill: '生物信息分析', aliases: ['生物信息', 'bioinformatics', 'ngs', '测序数据'] },
  { skill: '基因组分析', aliases: ['基因组', 'wgs', 'wes', '变异检测'] },
  { skill: '变异注释与评级', aliases: ['acmg', 'clinvar', '变异注释', 'vep'] },
  { skill: '多组学整合', aliases: ['多组学', '转录组', '蛋白组', '代谢组', '单细胞'] },
  { skill: '统计分析', aliases: ['统计分析', '统计建模', '假设检验', '生存分析', '回归分析'] },
  { skill: '临床试验与 GCP', aliases: ['gcp', 'ich-gcp', '临床试验'] },
  { skill: 'EDC 系统', aliases: ['edc', 'medidata', 'veeva'] },
  { skill: '数据管理（CDM）', aliases: ['数据管理', '数据清理', 'query', 'crc'] },
  { skill: '医学编码', aliases: ['meddra', 'who drug', '医学编码'] },
  { skill: '数据清洗', aliases: ['数据清洗', '数据预处理', 'etl'] },
  { skill: '数据可视化', aliases: ['数据可视化', 'tableau', 'power bi', 'powerbi', '看板'] },
  { skill: 'Excel', aliases: ['excel', '数据透视表'] },
  { skill: 'Docker', aliases: ['docker', '容器化'] },
  { skill: 'Git', aliases: ['git', '版本管理'] },
  { skill: '云计算/服务器', aliases: ['云计算', '服务器', '集群', 'hpc'] },
  { skill: '数据库', aliases: ['数据库', 'mysql', 'postgres', 'oracle'] },
  { skill: '文献检索', aliases: ['文献检索', 'pubmed', '文献调研'] },
  { skill: '英文读写', aliases: ['英语', '英文', '六级', 'cet-6', '读写能力'] },
  { skill: '论文/报告写作', aliases: ['论文写作', '报告撰写', 'sci', '写作能力'] },
  { skill: '项目管理', aliases: ['项目管理', '进度管理', '协调能力'] },
  { skill: '沟通表达', aliases: ['沟通', '表达能力', '跨部门'] },
  { skill: '需求分析与原型', aliases: ['需求分析', '原型', 'figma', 'axure', '产品设计'] },
  { skill: '医疗业务知识', aliases: ['his', '电子病历', 'emr', '临床路径', '医保'] },
  { skill: '注册与法规', aliases: ['注册', '法规', 'nmpa', 'fda', '合规'] },
];

const RESPONSIBILITY_HEADERS = [
  '岗位职责',
  '工作职责',
  '职位描述',
  '工作内容',
  '职责描述',
  '主要职责',
  '你将负责',
  '工作职责：',
];

const REQUIREMENT_HEADERS = [
  '任职要求',
  '任职资格',
  '岗位要求',
  '任职条件',
  '职位要求',
  '我们希望你',
  '要求',
];

const PREFERRED_HINTS = ['加分项', '优先', '加分', '更佳', 'preferred', 'plus'];

function normalize(line: string): string {
  return line.replace(/^[\s\u3000]*[•·\-*+>]+/, '').replace(/^\s*\d+[.、)]\s*/, '').trim();
}

function isHeader(line: string, headers: string[]): boolean {
  const bare = line.replace(/[：:\s]/g, '');
  return headers.some((header) => bare === header.replace(/[：:\s]/g, '') || bare === header);
}

type Section = 'responsibility' | 'requirement' | 'preferred' | 'other';

/**
 * 解析一段 JD 文本。
 *
 * 只做确定性的结构化：识别段落、抽学历/年限、用词典找技能、区分「必须」与「加分」。
 * 不做语义推断（那一步交给模型，在有原文的基础上）。
 */
export function parseJobDescription(text: string): ParsedJd {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  let title: string | null = null;
  const responsibilities: string[] = [];
  const requirements: string[] = [];
  let education: string | null = null;
  let experience: string | null = null;
  let section: Section = 'other';
  const skillPriority = new Map<string, 'required' | 'preferred'>();

  for (const [index, rawLine] of lines.entries()) {
    const line = normalize(rawLine);

    if (title === null) {
      const labeled = /(?:岗位|职位|职位名称|招聘岗位)[：:]\s*(.+)/.exec(rawLine);
      if (labeled !== null) {
        title = labeled[1]!.trim();
        continue;
      }
      // 第一行短、不带句号，通常就是标题
      if (index === 0 && line.length <= 30 && !/[。；;]/.test(line) && !isHeader(rawLine, [...RESPONSIBILITY_HEADERS, ...REQUIREMENT_HEADERS])) {
        title = line;
        continue;
      }
    }

    if (isHeader(rawLine, RESPONSIBILITY_HEADERS)) {
      section = 'responsibility';
      continue;
    }
    if (isHeader(rawLine, REQUIREMENT_HEADERS)) {
      section = 'requirement';
      continue;
    }
    if (PREFERRED_HINTS.some((hint) => rawLine.toLowerCase().includes(hint))) {
      section = 'preferred';
      // 加分项那行本身也可能是技能描述，继续往下走
    }

    if (line === '') continue;

    if (section === 'responsibility') responsibilities.push(line);
    else if (section === 'requirement' || section === 'preferred') requirements.push(line);

    const educationMatch = /(博士|硕士|本科|大专|专科)(研究生)?(及以上|以上)?/.exec(line);
    if (educationMatch !== null && education === null) {
      education = `${educationMatch[1]}${educationMatch[3] ?? ''}`;
    }

    if (experience === null) {
      const rangeMatch = /(\d+)\s*[-–—~至]\s*(\d+)\s*年/.exec(line);
      const singleMatch = rangeMatch === null ? /(\d+)\s*年(以上)?/.exec(line) : null;
      if (rangeMatch !== null) {
        experience = `${rangeMatch[1]}-${rangeMatch[2]} 年`;
      } else if (singleMatch !== null) {
        experience = `${singleMatch[1]} 年${singleMatch[2] === '以上' ? '以上' : ''}`;
      }
    }

    const lower = line.toLowerCase();
    for (const entry of SKILL_LEXICON) {
      if (!entry.aliases.some((alias) => lower.includes(alias))) continue;
      const priority = section === 'preferred' ? 'preferred' : 'required';
      // 必需优先：同一技能在正文与加分项都出现时按 required 算
      if (skillPriority.get(entry.skill) !== 'required') skillPriority.set(entry.skill, priority);
    }
  }

  if (title === null) {
    const first = lines[0] !== undefined ? normalize(lines[0]) : '';
    title = first.length > 0 && first.length <= 40 ? first : null;
  }

  const skills = [...skillPriority.entries()].map(([skill, priority]) => ({ skill, priority }));
  const keywords = uniqueWords([title ?? '', ...skills.map((entry) => entry.skill)]);

  return { title, education, experience, responsibilities, requirements, skills, keywords };
}

function uniqueWords(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}