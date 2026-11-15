/**
 * Zotero 只读适配层。
 *
 * 边界（写进 COMPLIANCE.md 的红线，代码在这里落实）：
 * - **只读**：以 `readOnly` 打开；Zotero 运行时可能锁库，所以锁住时退化为「先复制再读」。
 * - **不下载**：本模块只认 Zotero 里已经存在的附件，绝不替用户去抓 PDF。
 * - **不写入 Zotero 目录**：副本一律写到系统临时目录，用完即弃。
 *
 * 表结构依据 Zotero 7 的真实 schema（已在用户机器上核对）：
 * items / itemTypes / itemData / itemDataValues / fields / creators / creatorTypes /
 * itemCreators / itemAttachments / collections / collectionItems / tags / itemTags / deletedItems
 */
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ZoteroCreator {
  /** 显示名：`姓, 名` 或单字段名。 */
  name: string;
  role: string;
}

export interface ZoteroAttachment {
  /** 附件条目的 Zotero key，用于拼 storage 路径。 */
  key: string;
  /** 0=imported_file 1=imported_url 2=linked_file 3=linked_url */
  linkMode: number;
  contentType: string | null;
  /** 相对路径（`storage:` 前缀）或绝对路径；linked_url 为 null。 */
  rawPath: string | null;
  /** 解析后的绝对路径；无法解析（例如只有链接）时为 null。 */
  filePath: string | null;
}

export interface ZoteroItem {
  itemID: number;
  key: string;
  itemType: string;
  title: string | null;
  abstract: string | null;
  date: string | null;
  publication: string | null;
  doi: string | null;
  url: string | null;
  extra: string | null;
  creators: ZoteroCreator[];
  collections: string[];
  tags: string[];
  attachments: ZoteroAttachment[];
}

export interface ZoteroLibrarySummary {
  items: number;
  attachments: number;
  collections: number;
  byType: Record<string, number>;
}

export interface OpenOptions {
  /** 库被锁时的兜底：复制到临时目录再读（默认 true）。 */
  copyOnLock?: boolean;
}

/** 打开 Zotero 库。返回的句柄需要手动 close()（若用了副本，close 时一并清理）。 */
export interface ZoteroHandle {
  db: DatabaseSync;
  /** 实际读取的数据库路径（可能是临时副本）。 */
  path: string;
  /** 是否使用了临时副本。 */
  isCopy: boolean;
  close(): void;
}

function stageCopy(dbPath: string): { path: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-zotero-'));
  const target = join(dir, 'zotero.sqlite');
  copyFileSync(dbPath, target);
  // WAL 模式下未落盘的改动在 -wal 里，缺了它读到的可能是旧快照。
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (existsSync(sidecar)) copyFileSync(sidecar, `${target}${suffix}`);
  }
  return { path: target, dir };
}

export function openZoteroDb(dbPath: string, options: OpenOptions = {}): ZoteroHandle {
  const copyOnLock = options.copyOnLock ?? true;
  if (!existsSync(dbPath)) throw new Error(`Zotero 数据库不存在：${dbPath}`);

  const tryOpen = (path: string): DatabaseSync => {
    const db = new DatabaseSync(path, { readOnly: true });
    // readOnly 打开本身是惰性的，强制读一次 schema 才能确认没被锁。
    db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get();
    return db;
  };

  try {
    const db = tryOpen(dbPath);
    return { db, path: dbPath, isCopy: false, close: () => db.close() };
  } catch (error) {
    if (!copyOnLock) throw error;
    const staged = stageCopy(dbPath);
    const db = tryOpen(staged.path);
    return {
      db,
      path: staged.path,
      isCopy: true,
      close: () => {
        db.close();
        rmSync(staged.dir, { recursive: true, force: true });
      },
    };
  }
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/** 在 chunk 内取字段值，规避 SQLite 的参数个数上限。 */
function chunked<T>(ids: number[], size = 500): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

interface BasicRow {
  itemID: number;
  key: string;
  typeName: string;
}

/** 列出文献条目（不含 attachment/note/annotation，跳过回收站）。 */
export function listItems(handle: ZoteroHandle, limit = 500): ZoteroItem[] {
  const db = handle.db;
  const basics = db
    .prepare(
      `SELECT i.itemID, i.key, it.typeName
       FROM items i JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
       WHERE it.typeName NOT IN ('attachment', 'note', 'annotation')
         AND i.itemID NOT IN (SELECT itemID FROM deletedItems)
       ORDER BY i.dateAdded DESC
       LIMIT ?`,
    )
    .all(limit) as unknown as BasicRow[];
  return hydrate(handle, basics);
}

/** 按 key 或 itemID 读取单条文献。 */
export function getItem(handle: ZoteroHandle, keyOrId: string | number): ZoteroItem | null {
  const db = handle.db;
  const row =
    typeof keyOrId === 'number'
      ? (db
          .prepare(
            `SELECT i.itemID, i.key, it.typeName FROM items i
             JOIN itemTypes it ON it.itemTypeID = i.itemTypeID WHERE i.itemID = ?`,
          )
          .get(keyOrId) as unknown as BasicRow | undefined)
      : (db
          .prepare(
            `SELECT i.itemID, i.key, it.typeName FROM items i
             JOIN itemTypes it ON it.itemTypeID = i.itemTypeID WHERE i.key = ?`,
          )
          .get(keyOrId) as unknown as BasicRow | undefined);
  if (!row) return null;
  return hydrate(handle, [row])[0] ?? null;
}

function hydrate(handle: ZoteroHandle, basics: BasicRow[]): ZoteroItem[] {
  const db = handle.db;
  if (basics.length === 0) return [];

  const byId = new Map<number, ZoteroItem>();
  for (const row of basics) {
    byId.set(row.itemID, {
      itemID: row.itemID,
      key: row.key,
      itemType: row.typeName,
      title: null,
      abstract: null,
      date: null,
      publication: null,
      doi: null,
      url: null,
      extra: null,
      creators: [],
      collections: [],
      tags: [],
      attachments: [],
    });
  }

  const ids = basics.map((b) => b.itemID);
  const wanted = new Set(['title', 'abstractNote', 'date', 'publicationTitle', 'DOI', 'url', 'extra', 'conferenceName', 'publisher', 'university']);

  for (const part of chunked(ids)) {
    const marks = placeholders(part.length);

    const fields = db
      .prepare(
        `SELECT d.itemID, f.fieldName, v.value
         FROM itemData d
         JOIN fields f ON f.fieldID = d.fieldID
         JOIN itemDataValues v ON v.valueID = d.valueID
         WHERE d.itemID IN (${marks})`,
      )
      .all(...part) as unknown as Array<{ itemID: number; fieldName: string; value: string }>;

    for (const f of fields) {
      if (!wanted.has(f.fieldName)) continue;
      const item = byId.get(f.itemID);
      if (!item) continue;
      switch (f.fieldName) {
        case 'title':
          item.title = f.value;
          break;
        case 'abstractNote':
          item.abstract = f.value;
          break;
        case 'date':
          item.date = f.value;
          break;
        case 'publicationTitle':
        case 'conferenceName':
        case 'publisher':
        case 'university':
          item.publication = item.publication ?? f.value;
          break;
        case 'DOI':
          item.doi = f.value;
          break;
        case 'url':
          item.url = f.value;
          break;
        case 'extra':
          item.extra = f.value;
          break;
        default:
          break;
      }
    }

    const creators = db
      .prepare(
        `SELECT ic.itemID, c.firstName, c.lastName, ct.creatorType
         FROM itemCreators ic
         JOIN creators c ON c.creatorID = ic.creatorID
         JOIN creatorTypes ct ON ct.creatorTypeID = ic.creatorTypeID
         WHERE ic.itemID IN (${marks})
         ORDER BY ic.itemID, ic.orderIndex`,
      )
      .all(...part) as unknown as Array<{
      itemID: number;
      firstName: string | null;
      lastName: string | null;
      creatorType: string;
    }>;

    for (const c of creators) {
      const item = byId.get(c.itemID);
      if (!item) continue;
      const last = (c.lastName ?? '').trim();
      const first = (c.firstName ?? '').trim();
      item.creators.push({
        name: last && first ? `${last}, ${first}` : last || first,
        role: c.creatorType,
      });
    }

    const collections = db
      .prepare(
        `SELECT ci.itemID, c.collectionName
         FROM collectionItems ci JOIN collections c ON c.collectionID = ci.collectionID
         WHERE ci.itemID IN (${marks})`,
      )
      .all(...part) as unknown as Array<{ itemID: number; collectionName: string }>;
    for (const c of collections) byId.get(c.itemID)?.collections.push(c.collectionName);

    const tags = db
      .prepare(
        `SELECT it.itemID, t.name FROM itemTags it JOIN tags t ON t.tagID = it.tagID
         WHERE it.itemID IN (${marks})`,
      )
      .all(...part) as unknown as Array<{ itemID: number; name: string }>;
    for (const t of tags) byId.get(t.itemID)?.tags.push(t.name);
  }

  return basics.map((b) => byId.get(b.itemID) as ZoteroItem);
}

/**
 * 解析附件真实路径。
 *
 * Zotero 的 `path` 字段：imported_file/imported_url 形如 `storage:filename.pdf`，
 * 真实位置是 `<dataDir>/storage/<attachmentKey>/<filename>`；linked_file 存绝对路径。
 */
export function resolveAttachmentPath(
  attachment: Pick<ZoteroAttachment, 'key' | 'linkMode' | 'rawPath'>,
  zoteroDataDir: string,
): string | null {
  const raw = attachment.rawPath;
  if (!raw) return null;
  if (attachment.linkMode === 2) return raw; // linked_file：本来就是绝对路径
  if (attachment.linkMode === 3) return null; // linked_url：没有本地文件
  const filename = raw.startsWith('storage:') ? raw.slice('storage:'.length) : raw;
  return join(zoteroDataDir, 'storage', attachment.key, filename);
}

/** 列出某条文献的附件（含 storage 路径解析）。 */
export function listAttachments(
  handle: ZoteroHandle,
  parentItemID: number,
  zoteroDataDir: string,
): ZoteroAttachment[] {
  const rows = handle.db
    .prepare(
      `SELECT i.key, a.linkMode, a.contentType, a.path
       FROM itemAttachments a JOIN items i ON i.itemID = a.itemID
       WHERE a.parentItemID = ? AND a.itemID NOT IN (SELECT itemID FROM deletedItems)
       ORDER BY a.itemID`,
    )
    .all(parentItemID) as unknown as Array<{
    key: string;
    linkMode: number;
    contentType: string | null;
    path: string | null;
  }>;

  return rows.map((row) => {
    const attachment: ZoteroAttachment = {
      key: row.key,
      linkMode: row.linkMode,
      contentType: row.contentType,
      rawPath: row.path,
      filePath: null,
    };
    attachment.filePath = resolveAttachmentPath(attachment, zoteroDataDir);
    return attachment;
  });
}

/** 给条目补上附件信息（listItems 不查附件，避免 N+1 之外的额外开销）。 */
export function attachFiles(
  handle: ZoteroHandle,
  items: ZoteroItem[],
  zoteroDataDir: string,
): ZoteroItem[] {
  for (const item of items) {
    item.attachments = listAttachments(handle, item.itemID, zoteroDataDir);
  }
  return items;
}

/** 库概况：用于「先看一眼用户有什么」而不是一上来就全量导入。 */
export function summarize(handle: ZoteroHandle): ZoteroLibrarySummary {
  const db = handle.db;
  const items = db
    .prepare(
      `SELECT COUNT(*) AS n FROM items i JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
       WHERE it.typeName NOT IN ('attachment', 'note', 'annotation')
         AND i.itemID NOT IN (SELECT itemID FROM deletedItems)`,
    )
    .get() as unknown as { n: number };
  const attachments = db
    .prepare('SELECT COUNT(*) AS n FROM itemAttachments')
    .get() as unknown as { n: number };
  const collections = db.prepare('SELECT COUNT(*) AS n FROM collections').get() as unknown as {
    n: number;
  };
  const byType = db
    .prepare(
      `SELECT it.typeName AS name, COUNT(*) AS n
       FROM items i JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
       WHERE it.typeName NOT IN ('attachment', 'note', 'annotation')
         AND i.itemID NOT IN (SELECT itemID FROM deletedItems)
       GROUP BY it.typeName ORDER BY n DESC`,
    )
    .all() as unknown as Array<{ name: string; n: number }>;

  const histogram: Record<string, number> = {};
  for (const row of byType) histogram[row.name] = Number(row.n);

  return {
    items: Number(items.n),
    attachments: Number(attachments.n),
    collections: Number(collections.n),
    byType: histogram,
  };
}