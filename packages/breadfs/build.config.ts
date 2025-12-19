import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index', 'src/mem', 'src/node', 'src/webdav'],
  externals: ['@breadfs/mem', '@breadfs/node', '@breadfs/webdav'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true
  }
});
