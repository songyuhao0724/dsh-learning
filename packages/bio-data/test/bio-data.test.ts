import { describe, expect, it } from 'vitest';
import { cngbDeepLinks, cngbLink, CNGB_PORTALS } from '../src/cngbdb.js';
import { esearchUrl, esummaryUrl, parseCount, parseIds, summaryEntries } from '../src/eutils.js';
import { geoUrl, parseGeoSummary, searchGeo } from '../src/geo.js';
import { parseSraSummary, searchSra, sraUrl } from '../src/sra.js';
import type { FetchLike } from '../src/types.js';

const GEO_SEARCH = { esearchresult: { count: '3', idlist: ['200349653', '200303413'] } };
const GEO_SUMMARY = {
  result: {
    uids: ['200349653', '200303413', '200000001'],
    '200349653': {
      accession: 'GSE349653',
      title: 'IgD-secreting plasma cells in lung cancer',
      summary: 'We profile plasma cells.',
      taxon: 'Homo sapiens',
      gdstype: 'Expression profiling by high throughput sequencing',
      n_samples: '12',
      gpl: 'GPL24676',
      pubmedids: ['40000001'],
      pdat: '2026/01/05',
      ftplink: 'ftp://ftp.ncbi.nlm.nih.gov/geo/series/GSE349nnn/GSE349653/',
      bioproject: 'PRJNA123',
    },
    // 平台级命中，没有 GSE 编号：应被跳过
    '200303413': { accession: 'GPL24676', title: 'Illumina NovaSeq 6000' },
    '200000001': { error: 'cannot get document summary' },
  },
};

const SRA_EXPXML = `<Summary><Title>Single-cell atlas of lung cancer</Title><Platform accession="GPL24676" title="Illumina NovaSeq 6000"/><Study acc="SRP513716"/><Organism taxid="9606" ScientificName="Homo sapiens"/></Summary><Runs><Run acc="SRR41361950" total_spots="103480868" total_bases="31044260400" is_public="true"/><Run acc="SRR41361951" total_spots="1" total_bases="2" is_public="true"/></Runs>`;
const SRA_SUMMARY = { result: { uids: ['47565822'], '47565822': { expxml: SRA_EXPXML } } };

function fakeFetch(): FetchLike {
  return async (input) => {
    if (input.includes('db=gds') && input.includes('esearch')) {
      return { ok: true, status: 200, json: async () => GEO_SEARCH };
    }
    if (input.includes('db=gds') && input.includes('esummary')) {
      return { ok: true, status: 200, json: async () => GEO_SUMMARY };
    }
    if (input.includes('db=sra') && input.includes('esearch')) {
      return { ok: true, status: 200, json: async () => ({ esearchresult: { count: '48730', idlist: ['47565822'] } }) };
    }
    if (input.includes('db=sra') && input.includes('esummary')) {
      return { ok: true, status: 200, json: async () => SRA_SUMMARY };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

describe('E-utilities 基础设施', () => {
  it('URL 带 db / retmode / retmax / term，且 tool/email 会被编码', () => {
    const url = esearchUrl('gds', 'lung cancer AND "Homo sapiens"[Organism]', 5, { tool: 'dsh-learning', email: 'a@b.c' });
    expect(url).toContain('/esearch.fcgi?db=gds&retmode=json&retmax=5&term=');
    expect(url).toContain('tool=dsh-learning');
    expect(url).toContain('email=a%40b.c');
    expect(esummaryUrl('gds', ['1', '2'])).toContain('id=1,2');
  });

  it('解析 idlist 与 count', () => {
    expect(parseIds(GEO_SEARCH)).toEqual(['200349653', '200303413']);
    expect(parseCount(GEO_SEARCH)).toBe(3);
    expect(parseIds({})).toEqual([]);
    expect(parseCount({ esearchresult: { count: 'oops' } })).toBe(0);
  });

  it('跳过 error 条目与非法条目', () => {
    const entries = summaryEntries(GEO_SUMMARY);
    expect(entries.map((item) => item.uid)).toEqual(['200349653', '200303413']);
  });
});

describe('GEO 数据集', () => {
  it('把 esummary 条目解析成 GeoDataset', () => {
    const [dataset] = parseGeoSummary(GEO_SUMMARY);
    expect(dataset?.accession).toBe('GSE349653');
    expect(dataset?.organism).toBe('Homo sapiens');
    expect(dataset?.samples).toBe(12);
    expect(dataset?.pubmedIds).toEqual(['40000001']);
    expect(dataset?.url).toBe(geoUrl('GSE349653'));
    expect(dataset?.url).toContain('acc=GSE349653');
  });

  it('检索结果标注跳过的条目', async () => {
    const result = await searchGeo({ term: 'lung cancer', fetch: fakeFetch() });
    expect(result.source).toBe('geo');
    expect(result.count).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.warnings.join()).toContain('不是数据集级别');
  });

  it('空结果给可操作的提示', async () => {
    const emptyFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ esearchresult: { count: '0', idlist: [] } }) });
    const result = await searchGeo({ term: 'zzz-not-exist', fetch: emptyFetch });
    expect(result.items).toEqual([]);
    expect(result.warnings[0]).toContain('没有命中 GEO');
  });
});

describe('SRA 研究', () => {
  it('从 expxml 里拆出 accession / 标题 / 物种 / run 数', () => {
    const [study] = parseSraSummary(SRA_SUMMARY);
    expect(study?.accession).toBe('SRP513716');
    expect(study?.title).toBe('Single-cell atlas of lung cancer');
    expect(study?.organism).toBe('Homo sapiens');
    expect(study?.runs).toBe(2);
    expect(study?.url).toBe(sraUrl('SRP513716'));
  });

  it('命中数远大于列出条数时提醒收窄关键词', async () => {
    const result = await searchSra({ term: 'single cell', fetch: fakeFetch() });
    expect(result.count).toBe(48730);
    expect(result.items[0]?.accession).toBe('SRP513716');
    expect(result.warnings.join()).toContain('共命中 48730 条');
  });
});

describe('CNGBdb 深链', () => {
  it('关键词被编码进 URL', () => {
    const links = cngbDeepLinks('肺癌 单细胞');
    expect(links).toHaveLength(CNGB_PORTALS.length);
    expect(links[0]?.url).toContain(encodeURIComponent('肺癌 单细胞'));
    expect(links[0]?.note).toContain('申请');
  });

  it('没有关键词时给平台首页', () => {
    const links = cngbDeepLinks();
    expect(links.every((link) => !link.url.endsWith('='))).toBe(true);
    expect(cngbLink('gsa', 'lung')?.url).toContain('ngdc.cncb.ac.cn/gsa/search?searchTerm=lung');
  });
});