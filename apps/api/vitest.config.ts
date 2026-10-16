import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC statt esbuild, damit NestJS-Decorators samt Typ-Metadaten (Dependency Injection) übersetzt werden
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['test/**/*.test.ts'], fileParallelism: false },
});
