import {
  ScholarStore,
  importZoteroLibrary,
  indexPdfFile,
  openZoteroDb,
  summarize,
} from '@dsh-learning/scholar';
import { needPath, pickConfig, readNumber, readString, requireString, text } from '../args.js';
import type { PluginContext, ToolsConfig, ToolExec } from '../types.js';

const OBJECT = { type: 'object' } as const;

const ZOTERO_HINT = 'Zotero 的 zotero.sqlite 一般在 <数据目录>/zotero.sqlite，Windows 默认在 C:/Users/<你>/Zotero/zotero.sqlite。';

/** 文献侧工具：读 Zotero 库 → 建本地索引 → 带页码引用地检索。 */
export function registerPaperTools(ctx: PluginContext, config: ToolsConfig): void {
  const settings = pickConfig(config);

  ctx.tools.register({
    name: 'study_papers_summary',
    description: '读取本机 Zotero 文献库并给出统计（文献数、附件数、分类数、类型分布）。只读，不改动 Zotero 数据。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        zoteroDbPath: { type: 'string', description: 'zotero.sqlite 的完整路径；不传则用插件配置里的默认值。' },
        zoteroDataDir: { type: 'string', description: 'Zotero 数据目录（含 storage/ 的那一层），可选。' },
      },
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const stats = value as { items: number; attachments: number; collections: number; types: Array<{ type: string; count: number }> };
        const lines = [
          `文献 ${stats.items} 篇，附件 ${stats.attachments} 个，分类 ${stats.collections} 个。`,
          stats.types.length === 0 ? undefined : `类型分布：${stats.types.map((entry) => `${entry.type} ${entry.count}`).join('，')}`,
          stats.items === 0 ? '这个库里还没有文献：先在 Zotero 里用浏览器扩展抓几篇（配上 CARSI 登录态即可抓订阅库单篇）。' : undefined,
        ];
        return text(...lines);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const dbPath = needPath(args, 'zoteroDbPath', settings.zoteroDbPath, ZOTERO_HINT);
      const handle = openZoteroDb(dbPath);
      try {
        const summary = summarize(handle);
        const byType = (summary as unknown as { byType?: Record<string, number> }).byType ?? {};
        return {
          items: summary.items,
          attachments: summary.attachments,
          collections: summary.collections,
          types: Object.entries(byType)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count),
        };
      } finally {
        handle.close();
      }
    },
  });

  ctx.tools.register({
    name: 'study_papers_index',
    description:
      '把 Zotero 库里有本地 PDF 的文献抽成按页切块的文本，写进本地 SQLite 索引（幂等，可重复跑）。索引后就能用 study_papers_search 带页码引用地检索。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        zoteroDbPath: { type: 'string', description: 'zotero.sqlite 路径。' },
        zoteroDataDir: { type: 'string', description: 'Zotero 数据目录（含 storage/）。' },
        indexPath: { type: 'string', description: '索引库文件路径，比如 <工作区>/.dsh-learning/index.db。' },
        limit: { type: 'integer', description: '最多处理多少篇文献，默认 200。' },
      },
      required: ['indexPath'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as { documents: number; pages: number; skipped: Array<{ title: string; reason: string }>; indexPath: string };
        const reasonName: Record<string, string> = { 'no-pdf': '没有本地 PDF', 'no-text': '抽不出文字（多半是扫描件）', error: '出错' };
        const skipped = result.skipped.slice(0, 5).map((item) => `· ${item.title}（${reasonName[item.reason] ?? item.reason}）`);
        return text(
          `索引完成：${result.documents} 篇文献、${result.pages} 页，写入 ${result.indexPath}。`,
          result.skipped.length === 0 ? undefined : `跳过 ${result.skipped.length} 篇：`,
          ...skipped,
          result.skipped.length > 5 ? `…另有 ${result.skipped.length - 5} 篇被跳过` : undefined,
          result.documents === 0 ? '一篇都没索引成功：先确认 Zotero 里有带 PDF 的文献，或用 study_papers_index_pdf 单独索引一个文件。' : undefined,
        );
      },
    },
    async execute(args, exec: ToolExec) {
      const indexPath = needPath(args, 'indexPath', settings.indexDbPath, '传 indexPath，例如 <工作区>/.dsh-learning/index.db。');
      const dbPath = needPath(args, 'zoteroDbPath', settings.zoteroDbPath, ZOTERO_HINT);
      const dataDir = needPath(args, 'zoteroDataDir', settings.zoteroDataDir, 'Zotero 数据目录就是打开 Zotero 后「设置 → 高级 → 数据目录」里的那个路径。');
      const store = new ScholarStore(indexPath);
      try {
        const result = await importZoteroLibrary({
          dbPath,
          dataDir,
          store,
          limit: readNumber(args, 'limit') ?? 200,
        });
        if (exec.signal?.aborted === true) throw new Error('调用已取消');
        return {
          documents: result.documents,
          pages: result.pages,
          skipped: result.skipped.map((item) => ({ title: item.title, reason: item.reason })),
          indexPath,
        };
      } finally {
        store.close();
      }
    },
  });

  ctx.tools.register({
    name: 'study_papers_index_pdf',
    description: '索引单个 PDF 文件（不经过 Zotero），按页切块写入本地索引。适合老师发的讲义、自己下载的论文。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        filePath: { type: 'string', description: 'PDF 的完整路径。' },
        indexPath: { type: 'string', description: '索引库文件路径。' },
        title: { type: 'string', description: '给这篇文献一个标题，检索结果里会用它做引用名。' },
        docKey: { type: 'string', description: '文档的唯一键，重复索引同一篇时用它覆盖；不传则用文件路径。' },
      },
      required: ['filePath', 'indexPath'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as { docKey: string; pages: number };
        return text(`已索引 ${result.pages} 页：${result.docKey}。可以接着用 study_papers_search 检索。`);
      },
    },
    async execute(args) {
      const filePath = requireString(args, 'filePath', 'PDF 的完整路径');
      const indexPath = needPath(args, 'indexPath', settings.indexDbPath, '传 indexPath，例如 <工作区>/.dsh-learning/index.db。');
      const docKey = readString(args, 'docKey') ?? filePath;
      const title = readString(args, 'title');
      const store = new ScholarStore(indexPath);
      try {
        const result = await indexPdfFile(store, {
          filePath,
          docKey,
          meta: title === undefined ? {} : { title },
        });
        return { docKey: result.docKey, pages: result.pages };
      } finally {
        store.close();
      }
    },
  });

  ctx.tools.register({
    name: 'study_papers_search',
    description:
      '在本地文献索引里检索（中文按二元组切分 + FTS5 短语匹配，中英混排也能查），返回带文件名和页码的片段，用于写作业时给出可核对出处的引用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: '检索词，可以是中文短语、英文术语或混排，例如「卷积神经网络 脑卒中」。' },
        indexPath: { type: 'string', description: '索引库文件路径。' },
        limit: { type: 'integer', description: '返回多少条，默认 8。' },
      },
      required: ['query'],
    },
    output: {
      schema: OBJECT,
      render: (_args, value) => {
        const result = value as {
          query: string;
          count: number;
          hits: Array<{ title: string; page: number; snippet: string; score: number }>;
        };
        if (result.count === 0) {
          return text(`没有在本地索引里找到「${result.query}」。换个说法，或先用 study_papers_index 建立索引。`);
        }
        const blocks = result.hits.map(
          (hit, index) => `${index + 1}. 《${hit.title}》第 ${hit.page} 页\n   ${hit.snippet}`,
        );
        return text(`在本地文献里找到 ${result.count} 处与「${result.query}」相关的片段：`, '', ...blocks);
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const query = requireString(args, 'query', '要检索的词');
      const indexPath = needPath(args, 'indexPath', settings.indexDbPath, '传 indexPath，例如 <工作区>/.dsh-learning/index.db。');
      const store = new ScholarStore(indexPath);
      try {
        const hits = store.search(query, { limit: readNumber(args, 'limit') ?? 8 });
        return {
          query,
          count: hits.length,
          hits: hits.map((hit) => {
            const meta = hit.meta;
            const title = typeof meta.title === 'string' && meta.title !== '' ? meta.title : hit.docKey;
            return { title, page: hit.page, snippet: hit.snippet, score: Math.round(hit.score * 100) / 100, docKey: hit.docKey };
          }),
        };
      } finally {
        store.close();
      }
    },
  });
}