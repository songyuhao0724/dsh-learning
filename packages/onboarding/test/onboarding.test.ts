import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FIELDS,
  GROUPS,
  NEWS_DOMAIN_NAME,
  PROFILE_JSON_NAME,
  PROFILE_MD_NAME,
  checkResources,
  emptyProfile,
  extractMilestones,
  fieldByKey,
  fieldsOfGroup,
  loadProfile,
  profilePaths,
  profileStatus,
  profileSummaryLine,
  questionFor,
  readNewsDomain,
  readProfile,
  renderProfileMarkdown,
  renderWizardHtml,
  requiredFields,
  saveNewsDomain,
  saveProfile,
} from '../src/index.js';

let ws: string;

beforeEach(() => {
  ws = mkdtempSync(join(tmpdir(), 'dsh-onboarding-'));
});

afterEach(() => {
  rmSync(ws, { recursive: true, force: true });
});

describe('字段目录', () => {
  it('每个字段都属于某个分组，key 不重复', () => {
    const seen = new Set<string>();
    for (const { id } of GROUPS) {
      const fields = fieldsOfGroup(id);
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(field.group).toBe(id);
        expect(seen.has(field.key)).toBe(false);
        seen.add(field.key);
      }
    }
    expect(seen.size).toBe(FIELDS.length);
    expect(seen.size).toBeGreaterThanOrEqual(20);
  });

  it('select 字段必须带选项，questionFor 会拼出人话', () => {
    const degree = fieldByKey('degreeGoal');
    expect(degree?.kind).toBe('select');
    expect(degree?.options).toContain('考研');
    const question = questionFor(degree!);
    expect(question).toContain('考研');
    expect(question.endsWith('？') || question.includes('？')).toBe(true);
  });

  it('必填项覆盖身份、目标与资源三组的要害字段', () => {
    const keys = requiredFields().map((field) => field.key);
    expect(keys).toContain('name');
    expect(keys).toContain('degreeGoal');
    expect(keys).toContain('zoteroDbPath');
    expect(keys).not.toContain('role');
  });
});

describe('档案读写', () => {
  it('空档案的完成度为 0 且给出下一批问题', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    const status = profileStatus(profile);
    expect(status.completion).toBe(0);
    expect(status.ready).toBe(false);
    expect(status.missingRequired.length).toBe(status.requiredTotal);
    expect(status.nextQuestions.length).toBe(3);
    expect(status.headline).toContain('0%');
  });

  it('保存会同时写出 json 与 md，并创建 学习档案 目录', () => {
    const result = saveProfile(ws, { name: '宋宇昊', school: '康复大学', grade: '2026 级' });
    expect(result.files.json.endsWith(PROFILE_JSON_NAME)).toBe(true);
    expect(result.files.markdown.endsWith(PROFILE_MD_NAME)).toBe(true);
    expect(readFileSync(result.files.json, 'utf8')).toContain('宋宇昊');
    expect(readFileSync(result.files.markdown, 'utf8')).toContain('# 宋宇昊');
    expect(result.changed.sort()).toEqual(['grade', 'name', 'school']);
    expect(profilePaths(ws).dir.endsWith('学习档案')).toBe(true);
  });

  it('合并式保存：不清掉之前填的字段', () => {
    saveProfile(ws, { name: '宋宇昊', school: '康复大学' });
    const second = saveProfile(ws, { major: '生物信息学' });
    expect(second.profile.values.name).toBe('宋宇昊');
    expect(second.profile.values.major).toBe('生物信息学');
    expect(second.changed).toEqual(['major']);
  });

  it('空字符串表示删除该字段', () => {
    saveProfile(ws, { name: '宋宇昊', role: '文艺委员' });
    const result = saveProfile(ws, { role: '' });
    expect(result.profile.values.role).toBeUndefined();
    expect(result.changed).toEqual(['role']);
  });

  it('未知字段进 ignored，不写进档案', () => {
    const result = saveProfile(ws, { name: '宋宇昊', 不存在的字段: 'x' });
    expect(result.ignored).toEqual(['不存在的字段']);
    expect(Object.keys(result.profile.values)).toEqual(['name']);
  });

  it('再保存时保留 Markdown 里手写的里程碑', () => {
    saveProfile(ws, { name: '宋宇昊' });
    const mdPath = profilePaths(ws).markdown;
    // 在已有的「里程碑记录」小节里加一行（用户手写的），模拟真实编辑
    const current = readFileSync(mdPath, 'utf8');
    const edited = current.replace(
      /(## [^\n]*里程碑记录\n\n)/,
      '$1- 2026-11-18 首次填档案\n',
    );
    expect(edited).toContain('2026-11-18 首次填档案');
    writeFileSync(mdPath, edited, 'utf8');

    const result = saveProfile(ws, { major: '生物信息学' });
    const text = readFileSync(result.files.markdown, 'utf8');
    expect(text).toContain('2026-11-18 首次填档案');
    expect(text).toContain('生物信息学');
  });

  it('额外里程碑可以被追加', () => {
    saveProfile(ws, { name: '宋宇昊' }, { extraMilestones: ['2026-11-18 生成初始化向导'] });
    const text = readFileSync(profilePaths(ws).markdown, 'utf8');
    expect(text).toContain('生成初始化向导');
    expect(extractMilestones(text).length).toBe(1);
  });

  it('JSON 损坏时不抛错，回 error 且给空档案', () => {
    const paths = profilePaths(ws);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.json, '{ 这不是 json', 'utf8');
    const loaded = readProfile(ws);
    expect(loaded.exists).toBe(true);
    expect(loaded.error).toBeTruthy();
    expect(loaded.profile.version).toBe(1);
    expect(Object.keys(loaded.profile.values)).toEqual([]);
  });

  it('loadProfile 在文件不存在时返回空档案（exists 走 readProfile）', () => {
    const loaded = readProfile(ws);
    expect(loaded.exists).toBe(false);
    expect(loadProfile(ws).values).toEqual({});
    expect(profileStatus(loadProfile(ws)).completion).toBe(0);
  });
});

describe('Markdown 渲染', () => {
  it('按分组出表，未填的字段不进表但要提示', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    profile.values.name = '宋宇昊';
    profile.values.school = '康复大学';
    const md = renderProfileMarkdown(profile);
    expect(md).toContain('# 宋宇昊');
    expect(md).toContain('## 一、我是谁');
    expect(md).toContain('康复大学');
    expect(md).toContain('还没填');
  });

  it('摘要行能给人一句话印象', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    profile.values.name = '宋宇昊';
    profile.values.school = '康复大学';
    profile.values.major = '生物信息学';
    expect(profileSummaryLine(profile)).toContain('宋宇昊');
    expect(profileSummaryLine(profile)).toContain('康复大学');
  });

  it('竖线会被转义，避免撑破表格', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    profile.values.name = '宋宇昊';
    profile.values.currentFocus = '考研 | 论文';
    expect(renderProfileMarkdown(profile)).toContain('考研 \\| 论文');
  });
});

describe('资源体检', () => {
  it('全部缺失时给出 missing 与补救建议', () => {
    const report = checkResources({}, { exists: () => false, sizeOf: () => 0 });
    expect(report.missingCount).toBeGreaterThan(0);
    expect(report.items.every((item) => item.fix !== undefined || item.status === 'ok')).toBe(true);
    expect(report.headline).toContain('缺失');
  });

  it('路径填了但文件不存在要报 missing，不是静默通过', () => {
    const report = checkResources(
      { zoteroDbPath: 'C:/Users/x/Zotero/zotero.sqlite', zoteroDataDir: 'C:/Users/x/Zotero' },
      { exists: () => false, sizeOf: () => 0 },
    );
    const item = report.items.find((entry) => entry.key === 'zoteroDbPath');
    expect(item?.status).toBe('missing');
    expect(item?.detail).toContain('路径不存在');
    expect(item?.fix).toBeTruthy();
  });

  it('文件存在且体积正常时给 ok 并用人读单位', () => {
    const report = checkResources(
      { zoteroDbPath: 'C:/x/zotero.sqlite', zoteroDataDir: 'C:/x' },
      { exists: (path: string) => !path.endsWith('storage'), sizeOf: () => 2048 * 1024 },
    );
    const item = report.items.find((entry) => entry.key === 'zoteroDbPath');
    expect(item?.status).toBe('ok');
    expect(item?.detail).toContain('MB');
  });

  it('邮箱格式不对要 warn', () => {
    const report = checkResources({ contactEmail: 'not-an-email' }, { exists: () => true, sizeOf: () => 1024 });
    const item = report.items.find((entry) => entry.key === 'contactEmail');
    expect(item?.status).toBe('warn');
  });
});

describe('引导页', () => {
  it('生成单文件 HTML，内嵌字段数据且不漏值', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    profile.values.name = '宋宇昊';
    profile.values.currentFocus = '<script>alert(1)</script>';
    const html = renderWizardHtml({ profile, status: profileStatus(profile) });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('id="wizard-data"');
    expect(html).toContain('知航 · 初始化向导');
    // 危险字符必须被转义，不能原样出现在页面里
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('把资源体检结果带进页面', () => {
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    const report = checkResources({}, { exists: () => false, sizeOf: () => 0 });
    const html = renderWizardHtml({
      profile,
      status: profileStatus(profile),
      resources: report.items,
    });
    expect(html).toContain('资源体检');
    expect(html).toContain(report.items[0]!.label);
  });
});

describe('资讯方向', () => {
  it('没写过时 reads 到 exists=false 而不是抛错', () => {
    const read = readNewsDomain(ws);
    expect(read.exists).toBe(false);
    expect(read.domain).toBeUndefined();
    expect(read.file.endsWith(NEWS_DOMAIN_NAME)).toBe(true);
  });

  it('保存后能读回，词条去重并限量', () => {
    const saved = saveNewsDomain(ws, {
      topics: ['基因组学', '基因组学', ' 单细胞 ', ''],
      keywords: ['CRISPR', 'crispr', 'scRNA-seq'],
      exclude: ['招聘'],
      scoringNotes: '偏好方法学论文',
    });
    expect(saved.counts.topics).toBe(2);
    // 英文关键词大小写不敏感去重，只留第一次的写法
    expect(saved.counts.keywords).toBe(2);
    const read = readNewsDomain(ws);
    expect(read.exists).toBe(true);
    expect(read.domain?.topics).toEqual(['基因组学', '单细胞']);
    expect(read.domain?.keywords).toEqual(['CRISPR', 'scRNA-seq']);
    expect(read.domain?.scoringNotes).toBe('偏好方法学论文');
    expect(readFileSync(saved.file, 'utf8')).toContain('scoringNotes');
  });

  it('资讯需求是必填项，会出现在开场问题里', () => {
    const field = fieldByKey('newsInterest');
    expect(field?.group).toBe('news');
    expect(field?.required).toBe(true);
    const profile = emptyProfile('2026-01-01T00:00:00.000Z');
    profile.values.name = '宋宇昊';
    const status = profileStatus(profile);
    expect(status.missingRequired.map((field) => field.key)).toContain('newsInterest');
    expect(status.ready).toBe(false);
    // 身份四件套填完后，下一个该问的就是资讯需求（顺序：identity → news → goal）
    profile.values.school = '康复大学';
    profile.values.major = '生物信息学';
    profile.values.grade = '2026 级';
    const next = profileStatus(profile);
    expect(next.nextQuestions[0]).toContain('资讯');
  });
});