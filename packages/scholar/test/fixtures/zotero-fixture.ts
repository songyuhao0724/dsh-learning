/**
 * 测试夹具：在临时目录里造一个「缩小版 Zotero 7 数据库」。
 *
 * 只建读取代码真正用到的表，但列名/类型与真实 Zotero 保持一致，
 * 这样读取代码在真实库上行为一致，不需要用户先攒一堆文献才能测试。
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA = `
CREATE TABLE items (
  itemID INTEGER PRIMARY KEY, itemTypeID INT, dateAdded TEXT, dateModified TEXT,
  libraryID INT, key TEXT, version INT, synced INT
);
CREATE TABLE itemTypes (itemTypeID INTEGER PRIMARY KEY, typeName TEXT);
CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);
CREATE TABLE itemDataValues (valueID INTEGER PRIMARY KEY, value TEXT);
CREATE TABLE itemData (itemID INT, fieldID INT, valueID INT);
CREATE TABLE creators (
  creatorID INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT, fieldMode INT
);
CREATE TABLE creatorTypes (creatorTypeID INTEGER PRIMARY KEY, creatorType TEXT);
CREATE TABLE itemCreators (itemID INT, creatorID INT, creatorTypeID INT, orderIndex INT);
CREATE TABLE itemAttachments (
  itemID INTEGER PRIMARY KEY, parentItemID INT, linkMode INT, contentType TEXT, path TEXT
);
CREATE TABLE collections (
  collectionID INTEGER PRIMARY KEY, collectionName TEXT, parentCollectionID INT, key TEXT
);
CREATE TABLE collectionItems (collectionID INT, itemID INT, orderIndex INT);
CREATE TABLE tags (tagID INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE itemTags (itemID INT, tagID INT, type INT);
CREATE TABLE deletedItems (itemID INT, dateDeleted TEXT);
`;

export interface ZoteroFixture {
  dbPath: string;
  dataDir: string;
  /** 造出来的「真」附件文件路径，测试可以断言它能被解析到。 */
  paperPath: string;
  localPdfPath: string;
}

export interface ZoteroFixtureOptions {
  /** 写进 storage/ATTACH01/paper.pdf 的字节；给了真 PDF 就能测端到端抽取。 */
  paperPdf?: Uint8Array;
}

export function createZoteroFixture(options: ZoteroFixtureOptions = {}): ZoteroFixture {
  const root = mkdtempSync(join(tmpdir(), 'zotero-fixture-'));
  const dataDir = join(root, 'zotero-data');
  const dbPath = join(root, 'zotero.sqlite');
  mkdirSync(join(dataDir, 'storage', 'ATTACH01'), { recursive: true });

  const paperPath = join(dataDir, 'storage', 'ATTACH01', 'paper.pdf');
  writeFileSync(paperPath, options.paperPdf ?? '%PDF-1.4 fixture');
  const localPdfPath = join(root, 'local.pdf');
  writeFileSync(localPdfPath, '%PDF-1.4 local');

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const types: Array<[number, string]> = [
    [1, 'annotation'],
    [3, 'attachment'],
    [7, 'book'],
    [22, 'journalArticle'],
    [28, 'note'],
  ];
  const insertType = db.prepare('INSERT INTO itemTypes (itemTypeID, typeName) VALUES (?, ?)');
  for (const [id, name] of types) insertType.run(id, name);

  const fields: Array<[number, string]> = [
    [1, 'title'],
    [2, 'abstractNote'],
    [3, 'date'],
    [4, 'publicationTitle'],
    [5, 'DOI'],
    [6, 'url'],
    [7, 'extra'],
  ];
  const insertField = db.prepare('INSERT INTO fields (fieldID, fieldName) VALUES (?, ?)');
  for (const [id, name] of fields) insertField.run(id, name);

  const insertCreatorType = db.prepare(
    'INSERT INTO creatorTypes (creatorTypeID, creatorType) VALUES (?, ?)',
  );
  insertCreatorType.run(1, 'author');
  insertCreatorType.run(2, 'editor');

  const item = db.prepare(
    'INSERT INTO items (itemID, itemTypeID, dateAdded, libraryID, key) VALUES (?, ?, ?, 1, ?)',
  );
  item.run(1, 22, '2026-11-01 10:00:00', 'AAAA1111');
  item.run(2, 7, '2026-11-02 10:00:00', 'BBBB2222');
  item.run(3, 28, '2026-11-03 10:00:00', 'CCCC3333'); // note：不该出现在结果里
  item.run(4, 22, '2026-11-04 10:00:00', 'DDDD4444'); // 回收站：不该出现
  item.run(10, 3, '2026-11-01 10:05:00', 'ATTACH01'); // 附件条目本身
  item.run(11, 3, '2026-11-01 10:06:00', 'ATTACH02');
  item.run(12, 3, '2026-11-02 10:06:00', 'ATTACH03');

  const value = db.prepare('INSERT INTO itemDataValues (valueID, value) VALUES (?, ?)');
  const data = db.prepare('INSERT INTO itemData (itemID, fieldID, valueID) VALUES (?, ?, ?)');
  const addField = (itemID: number, fieldID: number, valueID: number, text: string): void => {
    value.run(valueID, text);
    data.run(itemID, fieldID, valueID);
  };

  addField(1, 1, 1, '卷积神经网络在康复评估中的应用');
  addField(1, 2, 2, '本文综述了深度学习在运动功能评估中的进展。');
  addField(1, 3, 3, '2025-06-01');
  addField(1, 4, 4, '中国康复医学杂志');
  addField(1, 5, 5, '10.1234/cjrm.2025.001');
  addField(1, 6, 6, 'https://example.org/paper-a');

  addField(2, 1, 7, '康复工程导论');
  addField(2, 3, 8, '2023');

  const creator = db.prepare(
    'INSERT INTO creators (creatorID, firstName, lastName, fieldMode) VALUES (?, ?, ?, 0)',
  );
  const itemCreator = db.prepare(
    'INSERT INTO itemCreators (itemID, creatorID, creatorTypeID, orderIndex) VALUES (?, ?, ?, ?)',
  );
  creator.run(1, '三', '张');
  creator.run(2, 'John', 'Smith');
  itemCreator.run(1, 1, 1, 0);
  itemCreator.run(1, 2, 1, 1);

  db.prepare('INSERT INTO collections (collectionID, collectionName, key) VALUES (1, ?, ?)').run(
    '康复与脑科学',
    'COLL0001',
  );
  db.prepare('INSERT INTO collectionItems (collectionID, itemID, orderIndex) VALUES (1, 1, 0)').run();

  db.prepare('INSERT INTO tags (tagID, name) VALUES (1, ?)').run('深度学习');
  db.prepare('INSERT INTO itemTags (itemID, tagID, type) VALUES (1, 1, 0)').run();

  const attachment = db.prepare(
    'INSERT INTO itemAttachments (itemID, parentItemID, linkMode, contentType, path) VALUES (?, ?, ?, ?, ?)',
  );
  attachment.run(10, 1, 0, 'application/pdf', 'storage:paper.pdf');
  attachment.run(11, 1, 2, 'application/pdf', localPdfPath);
  attachment.run(12, 2, 3, 'text/html', null);

  db.prepare("INSERT INTO deletedItems (itemID, dateDeleted) VALUES (4, '2026-11-05')").run();

  db.close();
  return { dbPath, dataDir, paperPath, localPdfPath };
}