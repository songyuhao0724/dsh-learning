import type { FeedSource } from './types.js';

/**
 * 精选信源：全部免费公开，不需要学校订阅、不需要 API key。
 *
 * 收录标准：① 有稳定 RSS/Atom；② 正文是「一篇文章」粒度（不是聚合列表页）；
 * ③ 从中国大陆网络实测可达（Cloudflare 拦截的源不收，见 FIXME 记录在文档里）。
 * AI/技术方向的 URL 与 AIHOT 项目（github.com/KKKKhazix/AIHOT）在用的信源保持一致，
 * 相当于把「读外国资讯」这一步搬进知航，不必再跑一套 AIHOT。
 */
export const FEED_SOURCES: FeedSource[] = [
  // ── 生物信息 / 生物医学 ────────────────────────────────────────────────
  {
    id: 'plos-compbiol',
    name: 'PLOS Computational Biology',
    url: 'https://journals.plos.org/ploscompbiol/feed/atom',
    kind: 'atom',
    group: '期刊',
    topics: ['生物信息学', '计算生物学'],
    lang: 'en',
  },
  {
    id: 'nature-methods',
    name: 'Nature Methods',
    url: 'https://www.nature.com/nmeth.rss',
    kind: 'rss',
    group: '期刊',
    topics: ['方法学', '生物信息学'],
    lang: 'en',
  },
  {
    id: 'nature-biotech',
    name: 'Nature Biotechnology',
    url: 'https://www.nature.com/nbt.rss',
    kind: 'rss',
    group: '期刊',
    topics: ['生物技术', '转化医学'],
    lang: 'en',
  },
  {
    id: 'cell-genomics',
    name: 'Cell Genomics',
    url: 'https://www.cell.com/cell-genomics/current.rss',
    kind: 'rss',
    group: '期刊',
    topics: ['基因组学', '多组学'],
    lang: 'en',
  },
  {
    id: 'biorxiv-bioinfo',
    name: 'bioRxiv · Bioinformatics',
    url: 'https://www.biorxiv.org/collection/bioinformatics/rss',
    kind: 'rss',
    group: '预印本',
    topics: ['预印本', '生物信息学'],
    lang: 'en',
    note: 'Cloudflare 对非浏览器 UA 可能返回挑战页；抓取失败时会明确报错，不影响其它源。',
  },
  {
    id: 'loman-lab',
    name: "Nick Loman Lab",
    url: 'https://lab.loman.net/atom.xml',
    kind: 'atom',
    group: '社区',
    topics: ['测序', '病原体基因组'],
    lang: 'en',
    note: 'Atom 里是全量归档（上百篇），首次抓取会一次入库。',
  },
  {
    id: 'haldanes-sieve',
    name: "Haldane's Sieve",
    url: 'https://haldanessieve.org/feed/',
    kind: 'rss',
    group: '社区',
    topics: ['群体遗传学', '预印本解读'],
    lang: 'en',
  },
  {
    id: 'r-bloggers',
    name: 'R-bloggers',
    url: 'https://www.r-bloggers.com/feed/',
    kind: 'rss',
    group: '社区',
    topics: ['R', '统计', '数据科学'],
    lang: 'en',
  },
  {
    id: 'gen-biotech',
    name: 'GEN · Genetic Engineering & Biotechnology News',
    url: 'https://www.genengnews.com/feed/',
    kind: 'rss',
    group: '媒体',
    topics: ['生物产业', '生物技术'],
    lang: 'en',
  },

  // ── AI / 计算 ─────────────────────────────────────────────────────────
  {
    id: 'openai-news',
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    kind: 'rss',
    group: '厂商官方',
    topics: ['大模型'],
    lang: 'en',
  },
  {
    id: 'google-deepmind',
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/rss.xml',
    kind: 'rss',
    group: '厂商官方',
    topics: ['大模型', 'AI for Science'],
    lang: 'en',
  },
  {
    id: 'google-research',
    name: 'Google Research',
    url: 'https://research.google/blog/rss/',
    kind: 'rss',
    group: '研究机构',
    topics: ['机器学习', 'AI for Science'],
    lang: 'en',
  },
  {
    id: 'hugging-face',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    kind: 'rss',
    group: '厂商官方',
    topics: ['开源模型', '工具'],
    lang: 'en',
  },
  {
    id: 'microsoft-research',
    name: 'Microsoft Research',
    url: 'https://www.microsoft.com/en-us/research/feed/',
    kind: 'rss',
    group: '研究机构',
    topics: ['机器学习', '生物医学 AI'],
    lang: 'en',
  },
  {
    id: 'nvidia-blog',
    name: 'NVIDIA Blog',
    url: 'https://blogs.nvidia.com/feed/',
    kind: 'rss',
    group: '厂商官方',
    topics: ['GPU', '加速计算'],
    lang: 'en',
  },
  {
    id: 'aws-ml',
    name: 'AWS Machine Learning Blog',
    url: 'https://aws.amazon.com/blogs/machine-learning/feed/',
    kind: 'rss',
    group: '厂商官方',
    topics: ['工程实践', '教程'],
    lang: 'en',
  },
  {
    id: 'github-ai',
    name: 'GitHub Blog · AI & ML',
    url: 'https://github.blog/ai-and-ml/feed/',
    kind: 'rss',
    group: '厂商官方',
    topics: ['工程实践', '工具'],
    lang: 'en',
  },
  {
    id: 'mistral-ai',
    name: 'Mistral AI',
    url: 'https://mistral.ai/news/rss',
    kind: 'rss',
    group: '厂商官方',
    topics: ['大模型'],
    lang: 'en',
  },
  {
    id: 'bair',
    name: 'Berkeley AI Research',
    url: 'https://bair.berkeley.edu/blog/feed.xml',
    kind: 'atom',
    group: '研究机构',
    topics: ['机器学习', '研究'],
    lang: 'en',
  },
  {
    id: 'the-verge-ai',
    name: 'The Verge · AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    kind: 'atom',
    group: '媒体',
    topics: ['行业动态'],
    lang: 'en',
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch · AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    kind: 'rss',
    group: '媒体',
    topics: ['行业动态', '融资'],
    lang: 'en',
  },
  {
    id: 'ars-technica-ai',
    name: 'Ars Technica · AI',
    url: 'https://arstechnica.com/ai/feed/',
    kind: 'rss',
    group: '媒体',
    topics: ['行业动态'],
    lang: 'en',
  },
  {
    id: 'mit-tech-review-ai',
    name: 'MIT Technology Review · AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    kind: 'rss',
    group: '媒体',
    topics: ['行业动态', '深度报道'],
    lang: 'en',
  },
  {
    id: 'the-decoder',
    name: 'The Decoder',
    url: 'https://the-decoder.com/feed/',
    kind: 'rss',
    group: '媒体',
    topics: ['行业动态'],
    lang: 'en',
  },
  {
    id: 'simon-willison',
    name: 'Simon Willison',
    url: 'https://simonwillison.net/atom/everything/',
    kind: 'atom',
    group: '社区',
    topics: ['工具', 'LLM 实践'],
    lang: 'en',
  },
  {
    id: 'import-ai',
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    kind: 'rss',
    group: '社区',
    topics: ['周报', '研究综述'],
    lang: 'en',
  },
  {
    id: 'latent-space',
    name: 'Latent Space',
    url: 'https://www.latent.space/feed',
    kind: 'rss',
    group: '社区',
    topics: ['访谈', '工程实践'],
    lang: 'en',
  },
];

/** 展示顺序：专业向在前，行业向在后。 */
export const FEED_GROUPS = ['期刊', '预印本', '厂商官方', '研究机构', '媒体', '社区'];

export function sourceById(id: string): FeedSource | undefined {
  return FEED_SOURCES.find((source) => source.id === id);
}

export function sourcesByGroup(group: string): FeedSource[] {
  return FEED_SOURCES.filter((source) => source.group === group);
}

/** 解析 `--sources a,b` 这类入参；未知 id 会进 unknown，由调用方决定报错还是忽略。 */
export function resolveSources(ids?: string[] | string): { picked: FeedSource[]; unknown: string[] } {
  const wanted = (Array.isArray(ids) ? ids : ids === undefined ? [] : [ids])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '');
  if (wanted.length === 0) return { picked: FEED_SOURCES, unknown: [] };
  const picked: FeedSource[] = [];
  const unknown: string[] = [];
  for (const id of wanted) {
    const source = sourceById(id);
    if (source === undefined) unknown.push(id);
    else picked.push(source);
  }
  return { picked, unknown };
}