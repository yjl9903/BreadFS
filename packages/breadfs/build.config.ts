import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index', 'src/node', 'src/webdav'],
  externals: ['@breadfs/node', '@breadfs/webdav'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true
  }
});
