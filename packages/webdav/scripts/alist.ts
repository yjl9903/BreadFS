import { BreadFS } from '@breadfs/core';
import { NodeFS } from '@breadfs/node';
import { WebDAVProvider } from '@breadfs/webdav';

const local = BreadFS.of(NodeFS);

const alist = BreadFS.of(
  new WebDAVProvider(`http://127.0.0.1:5244/dav`, {
    username: 'admin',
    password: 'abcdef'
  })
);

// const localFile = local.path('/Users/xlor/Desktop/sakura/sakura-13b-lnovel-v0.9b-Q2_K.gguf');
// const remoteFile = alist.path('/aliyundriver/sakura-13b-lnovel-v0.9b-Q2_K.gguf');
const localFile = local.path('README.md');
const remoteFile = alist.path('/aliyundriver/README.md');

// const contents = await localFile.readFile();
// await remoteFile.writeFile(contents);

await localFile.copyTo(remoteFile, {
  overwrite: true,
  fallback: {
    stream: {
      contentLength: true,
      onProgress(payload) {
        console.log(payload);
      }
    }
  }
});

// Wait for alist to process?
await new Promise((res) => {
  setTimeout(() => {
    res(undefined);
  }, 1000);
});

console.log(await remoteFile.readText());

await remoteFile.remove();
