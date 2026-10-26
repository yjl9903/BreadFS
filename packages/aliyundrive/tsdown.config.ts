import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  deps: { alwaysBundle: ['@breadfs/internal'] },
  clean: true,
  fixedExtension: true,
  format: ['esm', 'cjs']
});
