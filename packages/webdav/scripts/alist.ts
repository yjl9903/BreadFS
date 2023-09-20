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

const contents = await local.path('README.md').readFile();
await alist.path('/aliyundriver/README.md').writeFile(contents);
console.log(await alist.path('/aliyundriver/README.md').readText());
await alist.path('/aliyundriver/README.md').remove();
