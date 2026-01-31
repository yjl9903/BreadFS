import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index', 'src/mem', 'src/node', 'src/webdav', 'src/aliyundrive'],
  externals: ['@breadfs/mem', '@breadfs/node', '@breadfs/webdav', '@breadfs/aliyundrive'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true
  }
});
