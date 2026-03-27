import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/osv-security.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
});
