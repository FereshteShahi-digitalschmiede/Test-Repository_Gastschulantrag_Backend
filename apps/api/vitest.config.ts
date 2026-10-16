import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/testdatenbank.js';

// SWC statt esbuild, damit NestJS-Decorators samt Typ-Metadaten (Dependency Injection) übersetzt werden
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
  },
});
