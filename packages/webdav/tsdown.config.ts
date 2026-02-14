import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  fixedExtension: true,
  format: ['esm', 'cjs']
});
