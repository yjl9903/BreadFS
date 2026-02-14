import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/mem.ts', 'src/node.ts', 'src/webdav.ts', 'src/aliyundrive.ts'],
  external: ['@breadfs/mem', '@breadfs/node', '@breadfs/webdav', '@breadfs/aliyundrive'],
  dts: true,
  clean: true,
  fixedExtension: true,
  format: ['esm', 'cjs']
});
