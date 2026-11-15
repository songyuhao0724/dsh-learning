/**
 * @dsh-learning/carsi-router
 *
 * 「我要用的资源，学校到底有没有？」——把 CARSI 身份能换来的访问权限，
 * 变成三条具体能力：资源路由、可得性判定、检索式生成。
 *
 * 本包只做元数据与建议，不抓全文、不代登录、不绕付费墙。
 */
export * from './types.js';
export { CARSI_RESOURCES, CATALOG_META } from './data/carsi-resources.js';
export {
  listResources,
  findResources,
  recommendResources,
  openHint,
  catalogSummary,
  type FindOptions,
  type CatalogSummary,
} from './catalog.js';
export {
  buildSearchFormula,
  type SearchDatabase,
  type ArticleType,
  type SearchFormulaInput,
  type SearchFormula,
} from './search-formula.js';
export { planAccess, normalizeDoi } from './availability.js';