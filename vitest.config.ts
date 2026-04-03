import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const hbsLoader: Plugin = {
  name: 'hbs-loader',
  transform(code, id) {
    if (id.endsWith('.hbs')) {
      return { code: `export default ${JSON.stringify(code)}`, map: null };
    }
  },
};

export default defineConfig({
  plugins: [hbsLoader],
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
    },
  },
});
