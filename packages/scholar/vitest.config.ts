import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 必须在真实 Node 里跑：node:sqlite 是 Node 内置模块，jsdom/happy-dom 环境没有。
    environment: 'node',
    // Windows 的 GitHub 托管 runner 比开发机慢一个数量级：本机每个用例 150–300ms，
    // windows-latest 上实测 5–7s（PDF 抽取 + Zotero 夹具建库落在被实时扫描的临时目录里）。
    // 默认 5s/10s 会把「机器慢」报成「测试挂了」——见 run 44000503729 的失败。
    // 这里放宽到 30s：足够覆盖 runner 抖动，又不至于让真死循环跑太久。
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
  },
});