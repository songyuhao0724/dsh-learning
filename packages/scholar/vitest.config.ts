import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 必须在真实 Node 里跑：node:sqlite 是 Node 内置模块，jsdom/happy-dom 环境没有。
    environment: 'node',
    // 这个包是全仓最重的：每个用例要建一个 Zotero 夹具库（SQLite）再解析 PDF。
    // 开发机 150–300ms，Windows 托管 runner 上 3–6s（杀软实时扫描新落盘的 .sqlite）。
    // 于是默认配置会在慢机器上炸两处，都不是测试本身写错了：
    //   1. testTimeout/hookTimeout 默认 5s/10s —— 把「机器慢」报成「断言失败」
    //      （见 run 44000503729）；
    //   2. 多个测试文件并行时主线程被挤到喂不上 worker 的 onTaskUpdate 回调，
    //      vitest 抛 `[vitest-worker]: Timeout calling "onTaskUpdate"`，
    //      63 个测试全过也判失败（见 run 44001560645）。
    // 对策：放宽超时 + 用 fork 进程池顺序跑文件，让主线程永远有余量。
    // 这不是掩盖问题：真慢到超时、真断言失败，一样会红。
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
  },
});