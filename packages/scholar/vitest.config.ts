import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 必须在真实 Node 里跑：node:sqlite 是 Node 内置模块，jsdom/happy-dom 环境没有。
    environment: 'node',
  },
});