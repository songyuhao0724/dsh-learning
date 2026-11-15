import { describe, expect, it } from 'vitest';
import { parseJobDescription } from '../src/jd-parse.js';

const JD = `生物信息工程师
岗位职责：
1. 负责 NGS 数据分析流程的搭建与维护；
2. 使用 Python/R 完成数据清洗与可视化；
3. 与实验团队对接，输出分析报告。
任职要求：
1. 硕士及以上学历，生物信息、计算机相关专业；
2. 熟练掌握 Linux 命令行，有 1-3 年相关经验；
3. 熟悉机器学习基础，有 PyTorch 经验优先；
加分项：
4. 有 Docker 部署经验者优先；
5. 有单细胞分析经验优先。`;

describe('JD 解析', () => {
  const parsed = parseJobDescription(JD);

  it('抽出岗位名称', () => {
    expect(parsed.title).toBe('生物信息工程师');
  });

  it('抽出学历与年限要求', () => {
    expect(parsed.education).toBe('硕士及以上');
    expect(parsed.experience).toBe('1-3 年');
  });

  it('拆出职责与要求两类条目', () => {
    expect(parsed.responsibilities).toHaveLength(3);
    expect(parsed.responsibilities[0]).toContain('NGS');
    expect(parsed.requirements.length).toBeGreaterThanOrEqual(4);
  });

  it('区分必须技能与加分技能', () => {
    const bySkill = new Map(parsed.skills.map((entry) => [entry.skill, entry.priority]));
    expect(bySkill.get('Python')).toBe('required');
    expect(bySkill.get('Linux')).toBe('required');
    expect(bySkill.get('Docker')).toBe('preferred');
    expect(bySkill.get('多组学整合')).toBe('preferred');
  });

  it('同一个技能既是必须又出现在加分项时，按必须算', () => {
    const text = '岗位：数据分析师\n任职要求：\n1. 熟练使用 SQL；\n加分项：\n2. SQL 写得好优先；';
    const result = parseJobDescription(text);
    expect(result.skills.find((entry) => entry.skill === 'SQL')?.priority).toBe('required');
  });

  it('支持「岗位：」这种带标签的标题', () => {
    const result = parseJobDescription('岗位：临床数据管理员\n任职要求：\n1. 本科及以上；');
    expect(result.title).toBe('临床数据管理员');
    expect(result.education).toBe('本科及以上');
  });

  it('只有一行经验要求时也能解析', () => {
    const result = parseJobDescription('数据专员\n任职要求：\n1. 3 年以上相关经验；\n2. 熟悉 Excel；');
    expect(result.experience).toBe('3 年以上');
    expect(result.skills.map((entry) => entry.skill)).toContain('Excel');
  });

  it('纯描述文本不会崩，技能为空也不报错', () => {
    const result = parseJobDescription('我们希望你踏实肯干，愿意学习。');
    expect(result.skills).toEqual([]);
    expect(result.title).not.toBeNull();
  });

  it('空文本返回空结构而不是抛错', () => {
    const result = parseJobDescription('   ');
    expect(result.title).toBeNull();
    expect(result.responsibilities).toEqual([]);
    expect(result.requirements).toEqual([]);
  });
});