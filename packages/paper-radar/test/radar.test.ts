import { describe, expect, it } from 'vitest';
import { aihotSourceConfig, toAiHotFeed } from '../src/feed.js';
import { collectRadar } from '../src/radar.js';
import { parseArxivFeed } from '../src/sources/arxiv.js';
import { parseBiorxivRows, splitAuthors } from '../src/sources/biorxiv.js';
import { parsePubmedDate, parsePubmedIds, parsePubmedSummary } from '../src/sources/pubmed.js';
import { detectTopics, resolveTopics } from '../src/topics.js';
import type { FetchLike, RawPaper } from '../src/types.js';

const ARXIV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2601.01234v2</id>
    <published>2026-01-05T18:00:00Z</published>
    <title>Deep learning for medical imaging:
      a survey</title>
    <summary>We review deep learning methods for
    medical imaging.</summary>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
    <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.1000/xyz</arxiv:doi>
  </entry>
</feed>`;

const BIORXIV_PAYLOAD = {
  collection: [
    {
      doi: '10.1101/2026.01.01.123456',
      title: 'Single-cell transcriptomics of lung cancer',
      authors: 'Zhang San; Li Si',
      date: '2026-01-03',
      abstract: 'We profile single-cell transcriptomes.',
      version: '2',
    },
    { doi: '', title: 'bad row', authors: '', date: '2026-01-03' },
  ],
};

const PUBMED_SEARCH = { esearchresult: { count: '1', idlist: ['40000001'] } };
const PUBMED_SUMMARY = {
  result: {
    uids: ['40000001'],
    '40000001': {
      title: 'Genomic analysis of <i>EGFR</i> variants',
      pubdate: '2026 Jan 4',
      authors: [{ name: 'Wang Wu' }, { name: 'Zhao Liu' }],
      articleids: [{ idtype: 'doi', value: '10.1000/pubmed' }],
    },
  },
};

function fakeFetch(): FetchLike {
  return async (input) => {
    if (input.startsWith('https://export.arxiv.org')) {
      return { ok: true, status: 200, text: async () => ARXIV_XML, json: async () => ({}) };
    }
    if (input.startsWith('https://api.biorxiv.org')) {
      const isMed = input.includes('/medrxiv/');
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => (isMed ? { collection: [] } : BIORXIV_PAYLOAD),
      };
    }
    if (input.includes('esearch.fcgi')) {
      return { ok: true, status: 200, text: async () => '', json: async () => PUBMED_SEARCH };
    }
    if (input.includes('esummary.fcgi')) {
      return { ok: true, status: 200, text: async () => '', json: async () => PUBMED_SUMMARY };
    }
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
  };
}

describe('arXiv 解析', () => {
  it('抽出标题、作者、日期、DOI，并折叠跨行空白', () => {
    const [paper] = parseArxivFeed(ARXIV_XML);
    expect(paper?.id).toBe('arxiv:2601.01234');
    expect(paper?.title).toBe('Deep learning for medical imaging: a survey');
    expect(paper?.authors).toEqual(['Ada Lovelace', 'Alan Turing']);
    expect(paper?.publishedAt).toBe('2026-01-05T18:00:00.000Z');
    expect(paper?.doi).toBe('10.1000/xyz');
    expect(paper?.url).toBe('https://arxiv.org/abs/2601.01234');
  });
});

describe('bioRxiv 解析', () => {
  it('跳过坏行，作者按分号切分', () => {
    const papers = parseBiorxivRows(BIORXIV_PAYLOAD.collection, 'biorxiv');
    expect(papers).toHaveLength(1);
    expect(papers[0]?.authors).toEqual(['Zhang San', 'Li Si']);
    expect(papers[0]?.url).toContain('biorxiv.org/content/10.1101/2026.01.01.123456v2');
    expect(splitAuthors('A; B;C')).toEqual(['A', 'B', 'C']);
  });
});

describe('PubMed 解析', () => {
  it('去 HTML 标签、取 DOI、解析月份日期', () => {
    expect(parsePubmedIds(PUBMED_SEARCH)).toEqual(['40000001']);
    const [paper] = parsePubmedSummary(PUBMED_SUMMARY);
    expect(paper?.title).toBe('Genomic analysis of EGFR variants');
    expect(paper?.doi).toBe('10.1000/pubmed');
    expect(paper?.publishedAt.startsWith('2026-01-04')).toBe(true);
    expect(parsePubmedDate('2026').startsWith('2026-01-01')).toBe(true);
  });
});

describe('主题打标', () => {
  it('命中多个主题', () => {
    const topics = detectTopics('Single-cell transcriptomics and deep learning for medical imaging');
    expect(topics).toContain('genomics');
    expect(topics).toContain('medical-ai');
  });

  it('支持用中文标签筛主题', () => {
    expect(resolveTopics(['基因组与组学'])).toEqual(['genomics']);
    expect(resolveTopics(['genomics'])).toEqual(['genomics']);
  });
});

describe('collectRadar 汇总', () => {
  it('并行抓三源 + PubMed，去重并按日期倒序', async () => {
    const result = await collectRadar({
      fetch: fakeFetch(),
      query: 'single cell',
      days: 7,
      perSource: 5,
      now: new Date('2026-01-06T00:00:00Z'),
    });
    expect(result.warnings).toEqual([]);
    expect(result.perSource['arXiv']).toBe(1);
    expect(result.perSource['bioRxiv']).toBe(1);
    expect(result.perSource['medRxiv']).toBe(0);
    expect(result.perSource['PubMed']).toBe(1);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.publishedAt >= (result.items[1]?.publishedAt ?? '')).toBe(true);
  });

  it('某个源失败时只记 warning，其它源照常返回', async () => {
    const failing: FetchLike = async (input) => {
      if (input.startsWith('https://export.arxiv.org')) throw new Error('网络不通');
      return fakeFetch()(input);
    };
    const result = await collectRadar({ fetch: failing, now: new Date('2026-01-06T00:00:00Z') });
    expect(result.warnings.some((warning) => warning.includes('arXiv 抓取失败'))).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('按主题过滤，未命中的主题给 warning', async () => {
    const result = await collectRadar({
      fetch: fakeFetch(),
      topics: ['rehab'],
      now: new Date('2026-01-06T00:00:00Z'),
    });
    expect(result.items).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes('rehab'))).toBe(true);
  });
});

describe('AIHOT 契约', () => {
  const items: RawPaper[] = [
    {
      id: 'arxiv:1',
      source: 'arxiv',
      title: 'T',
      abstract: 'A',
      authors: ['X'],
      publishedAt: '2026-01-01T00:00:00.000Z',
      url: 'https://arxiv.org/abs/1',
    },
  ];

  it('导出 data.items、带时区 ISO 时间与 url', () => {
    const feed = toAiHotFeed(items.map((item) => ({ ...item, topics: ['genomics'] })));
    expect(feed.data.items).toHaveLength(1);
    expect(feed.data.items[0]?.published_at).toBe('2026-01-01T00:00:00.000Z');
    expect(feed.data.items[0]?.tags).toEqual(['基因组与组学']);
    expect(feed.data.items[0]?.url).toContain('arxiv.org');
  });

  it('采集配置只用 AIHOT 文档里出现过的键', () => {
    const config = aihotSourceConfig('https://example.com/radar.json');
    expect(config['mode']).toBe('json_api');
    expect(config['itemsPath']).toBe('data.items');
    expect(config['urlTemplate']).toBe('{raw:url}');
    for (const key of Object.keys(config)) {
      expect([
        'url',
        'mode',
        'itemsPath',
        'titlePaths',
        'summaryPaths',
        'urlTemplate',
        'publishedAtPath',
        'externalIdPath',
        'authorPaths',
      ]).toContain(key);
    }
  });
});