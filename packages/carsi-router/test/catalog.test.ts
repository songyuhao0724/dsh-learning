import { describe, expect, it } from 'vitest';
import {
  catalogSummary,
  findResources,
  listResources,
  openHint,
  recommendResources,
} from '../src/catalog.js';

describe('资源目录', () => {
  it('按关键词匹配名称：知网 → CNKI 排第一', () => {
    const hits = findResources('知网');
    expect(hits[0]?.id).toBe('cnki');
  });

  it('按覆盖范围匹配：能做文献计量的库', () => {
    const ids = findResources('文献计量').map((resource) => resource.id);
    expect(ids).toContain('web-of-science');
  });

  it('可以按类别与获取方式过滤', () => {
    const free = findResources('', { access: 'free' });
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((resource) => resource.access === 'free')).toBe(true);
    const data = findResources('', { category: 'data' });
    expect(data.every((resource) => resource.category === 'data')).toBe(true);
  });

  it('空查询返回全部，且限制条数生效', () => {
    expect(findResources('')).toHaveLength(listResources().length);
    expect(findResources('', { limit: 3 })).toHaveLength(3);
  });

  it('listResources 返回副本，改它不会污染内置数据', () => {
    const first = listResources()[0]!;
    first.name = '被改坏的名字';
    expect(listResources()[0]!.name).not.toBe('被改坏的名字');
  });

  it('按任务推荐：中文文献先推知网', () => {
    expect(recommendResources('literature-zh')[0]?.id).toBe('cnki');
    expect(recommendResources('research-data').map((resource) => resource.id)).toContain('cngbdb');
  });

  it('打开提示明确指向 CARSI 登录流程，不承诺可直接下载', () => {
    const hint = openHint(listResources()[0]!);
    expect(hint).toContain('CARSI');
    expect(hint).not.toContain('直接下载');
  });

  it('目录概况的计数与条目数自洽', () => {
    const summary = catalogSummary();
    const byAccessTotal = summary.byAccess.subscription + summary.byAccess.free + summary.byAccess.trial;
    expect(byAccessTotal).toBe(summary.total);
    expect(summary.meta.counts.total).toBe(96);
  });
});