# @dsh-learning/scholar

本地文献索引：把 Zotero 里的论文（以及你手动下载的 PDF）变成**可检索、可带页码引用**的全文库。

全部在本机完成：不发网络请求、不解密、不绕访问控制。只读 Zotero 数据库，绝不写用户库。

## 它解决什么问题

写论文/做课题时，真正卡住你的往往不是「找不到论文」，而是：

- 我知道我看过一篇讲 X 的，但想不起是哪篇、第几页；
- 找到了摘要，但要引用原文时还得一页页翻；
- 想让 AI 帮我总结，但通用 AI 没有我的文献库，只能编。

scholar 把「你的文献库」变成 AI 可检索的语料，命中结果自带标题、作者、年份、DOI 和**页码**。

## 怎么用

```bash
# 1. 看看 Zotero 库里有什么（只读，Zotero 开着也不冲突）
dsh-scholar summary --db "%USERPROFILE%\Zotero\zotero.sqlite" --data "%USERPROFILE%\Zotero"

# 2. 建索引（只处理已经有本地 PDF 的条目）
dsh-scholar index --db "%USERPROFILE%\Zotero\zotero.sqlite" --data "%USERPROFILE%\Zotero" --index scholar.db

# 3. 检索
dsh-scholar search --index scholar.db --query "卷积神经网络 脑卒中" --limit 5

# 手动下载的 PDF 也能进库
dsh-scholar index-file --file .\paper.pdf --index scholar.db --title "论文标题"
```

`--json` 输出机器可读结果，方便被 agent 或脚本消费。

## 作为库使用

```ts
import { ScholarStore, importZoteroLibrary } from '@dsh-learning/scholar';

const store = new ScholarStore('scholar.db');
await importZoteroLibrary({ dbPath: 'zotero.sqlite', dataDir: 'Zotero', store });

for (const hit of store.search('脑卒中 康复', { limit: 5 })) {
  console.log(`${hit.meta.title} · 第 ${hit.page} 页`);
  console.log(hit.snippet);
}
store.close();
```

## 技术要点

| 问题 | 做法 | 为什么 |
| --- | --- | --- |
| 中文全文检索 | CJK 重叠二元组预分词 + FTS5 短语匹配 | SQLite 的 `unicode61` 不切中文；`Intl.Segmenter` 会把「卷积」切成「卷\|积」。二元组零依赖、召回稳，精度靠短语匹配保证 |
| 存储 | Node 内置 `node:sqlite` + FTS5 | 零原生依赖，不用编译 sqlite3；索引就是一个文件，拷走即带走 |
| PDF 抽取 | `unpdf`（pdf.js 的 Node 版封装） | 纯 JS，无 native 模块；1.9.x 支持 Node 22 |
| Zotero 锁库 | 自动退化为「读副本」 | Zotero 运行时独占数据库；复制 `zotero.sqlite`（含 `-wal`/`-shm`）到临时目录再读 |
| 扫描件 | 检测到无文字层时明确报错 | v1 不做 OCR；宁可说清楚，也不静默返回空结果 |

## 已知限制（v1 有意为之）

- **分块粒度 = 页**。引用能精确到页，但很长的页不做二次切分。
- **不做 OCR**。扫描版 PDF 需要先自己 OCR。
- **不做向量检索**。词法检索（BM25）在几千页的个人库上够用，且完全离线、可解释。
- **不含 Zotero 之外的元数据抓取**。DOI/摘要来自 Zotero 条目本身。

## License

Apache-2.0