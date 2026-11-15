import type { CngbLink } from './types.js';

/**
 * 国内生命大数据平台只有网页门户，没有公开的检索 API（CNGBdb 的接口要申请）。
 * 所以这里**不抓页面**，只给「带着关键词跳过去」的深链 —— 抓取需要登录态的门户既不稳定也不合规。
 */
export const CNGB_PORTALS = [
  {
    id: 'cngbdb',
    name: '国家基因库生命大数据平台（CNGBdb）',
    home: 'https://db.cngb.org/',
    search: 'https://db.cngb.org/search/?q=',
    note: '综合检索：项目/样本/测序数据。部分数据需申请授权。',
  },
  {
    id: 'cnsa',
    name: 'CNGB 序列归档库（CNSA）',
    home: 'https://db.cngb.org/cnsa/',
    search: 'https://db.cngb.org/search/?q=',
    note: '序列数据归档，对应 NCBI 的 SRA/GSA 角色。',
  },
  {
    id: 'gsa',
    name: '国家基因组科学数据中心 GSA',
    home: 'https://ngdc.cncb.ac.cn/gsa/',
    search: 'https://ngdc.cncb.ac.cn/gsa/search?searchTerm=',
    note: '组学原始数据归档库，国内投稿常见。',
  },
] as const;

export type CngbPortalId = (typeof CNGB_PORTALS)[number]['id'];

/** 生成带关键词的门户深链；关键词为空时给平台首页。 */
export function cngbDeepLinks(term?: string): CngbLink[] {
  const keyword = term?.trim() ?? '';
  return CNGB_PORTALS.map((portal) => ({
    name: portal.name,
    url: keyword === '' ? portal.home : `${portal.search}${encodeURIComponent(keyword)}`,
    note: portal.note,
  }));
}

/** 按 id 取单个平台的深链。 */
export function cngbLink(id: CngbPortalId, term?: string): CngbLink | undefined {
  const index = CNGB_PORTALS.findIndex((portal) => portal.id === id);
  if (index < 0) return undefined;
  return cngbDeepLinks(term)[index];
}