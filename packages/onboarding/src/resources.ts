/**
 * 资源初始化体检。
 *
 * 只做「能不能真的跑起来」这一件事：路径存在吗、库是不是空的、邮箱格式对不对。
 * 不替用户创建索引库、不动 Zotero 目录 —— 检查就该是只读的。
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldValue, ResourceCheckItem, ResourceCheckReport, ResourceStatus } from './types.js';

export interface ResourceCheckOptions {
  /** 注入用：测试里替换掉真实文件系统。 */
  exists?: (path: string) => boolean;
  /** 返回字节数；不存在或读不到时返回 0。 */
  sizeOf?: (path: string) => number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textOf(values: Record<string, FieldValue>, key: string): string | undefined {
  const value = values[key];
  if (value === undefined) return undefined;
  const text = typeof value === 'number' ? String(value) : value;
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

function item(
  key: string,
  label: string,
  status: ResourceStatus,
  detail: string,
  fix?: string,
): ResourceCheckItem {
  return fix === undefined ? { key, label, status, detail } : { key, label, status, detail, fix };
}

/** 人读的体量：小于 1 MB 用 KB，大于等于 1 MB 用 MB（Zotero 库常年几百 MB）。 */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function checkResources(
  values: Record<string, FieldValue>,
  options: ResourceCheckOptions = {},
): ResourceCheckReport {
  const exists = options.exists ?? ((path: string) => existsSync(path));
  const sizeOf =
    options.sizeOf ??
    ((path: string) => {
      try {
        return statSync(path).size;
      } catch {
        return 0;
      }
    });

  const items: ResourceCheckItem[] = [];

  // ① zotero.sqlite
  const dbPath = textOf(values, 'zoteroDbPath');
  if (dbPath === undefined) {
    items.push(
      item('zoteroDbPath', 'zotero.sqlite', 'missing', '还没填数据库路径', 'Zotero → 编辑 → 首选项 → 高级 → 文件和文件夹，看「数据存储位置」，里面的 zotero.sqlite'),
    );
  } else if (!exists(dbPath)) {
    items.push(item('zoteroDbPath', 'zotero.sqlite', 'missing', `路径不存在：${dbPath}`, '确认 Zotero 已安装并至少打开过一次'));
  } else if (sizeOf(dbPath) < 1024) {
    items.push(item('zoteroDbPath', 'zotero.sqlite', 'warn', '文件存在但几乎是空的（可能还没同步任何文献）', '在 Zotero 里同步或拖入几篇 PDF 再看'));
  } else {
    items.push(item('zoteroDbPath', 'zotero.sqlite', 'ok', `已找到（${formatSize(sizeOf(dbPath))}）`));
  }

  // ② Zotero 数据目录（PDF 与全文缓存都在 storage/ 下）
  const dataDir = textOf(values, 'zoteroDataDir');
  if (dataDir === undefined) {
    items.push(item('zoteroDataDir', 'Zotero 数据目录', 'missing', '还没填数据目录', '同一处「数据存储位置」，填包含 storage 文件夹的那一层'));
  } else if (!exists(dataDir)) {
    items.push(item('zoteroDataDir', 'Zotero 数据目录', 'missing', `路径不存在：${dataDir}`, '复制「数据存储位置」的绝对路径'));
  } else if (!exists(join(dataDir, 'storage'))) {
    items.push(item('zoteroDataDir', 'Zotero 数据目录', 'warn', '目录在，但里面没有 storage（可能填成了上一级）', '往上/往下找包含 storage 的那一层'));
  } else {
    items.push(item('zoteroDataDir', 'Zotero 数据目录', 'ok', '已找到 storage 目录'));
  }

  // ③ 本地索引库
  const indexPath = textOf(values, 'indexDbPath');
  if (indexPath === undefined) {
    items.push(item('indexDbPath', '本地文献索引库', 'warn', '还没填索引库路径（能跑，但每次都要显式指定）', '填 `学习档案\\papers.db` 之类的路径'));
  } else if (!exists(indexPath)) {
    items.push(item('indexDbPath', '本地文献索引库', 'warn', '索引库还不存在（首次索引时会自动创建，属正常）', `让知航运行 study_papers_index（indexPath=${indexPath}）`));
  } else {
    items.push(item('indexDbPath', '本地文献索引库', 'ok', `已存在（${formatSize(sizeOf(indexPath))}）`));
  }

  // ④ 联系邮箱（Unpaywall / NCBI 要求带邮箱）
  const email = textOf(values, 'contactEmail');
  if (email === undefined) {
    items.push(item('contactEmail', '联系邮箱', 'missing', '还没填邮箱', 'Unpaywall 与 NCBI E-utilities 都要求带邮箱，缺了拿不到开放全文'));
  } else if (!EMAIL_PATTERN.test(email)) {
    items.push(item('contactEmail', '联系邮箱', 'warn', `格式不像邮箱：${email}`, '形如 you@example.edu.cn'));
  } else {
    items.push(item('contactEmail', '联系邮箱', 'ok', email));
  }

  // ⑤ CARSI 学校
  const institution = textOf(values, 'carsiInstitution');
  if (institution === undefined) {
    items.push(item('carsiInstitution', 'CARSI 所属学校', 'warn', '还没填学校', '填了之后资源路由才会提示「先登录 CARSI 再从门户点开」'));
  } else {
    items.push(item('carsiInstitution', 'CARSI 所属学校', 'ok', institution));
  }

  const okCount = items.filter((entry) => entry.status === 'ok').length;
  const warnCount = items.filter((entry) => entry.status === 'warn').length;
  const missingCount = items.filter((entry) => entry.status === 'missing').length;

  return {
    items,
    okCount,
    warnCount,
    missingCount,
    headline: `${okCount} 项就绪 / ${warnCount} 项待完善 / ${missingCount} 项缺失`,
  };
}