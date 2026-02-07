import 'dotenv/config';

import 'breadfs/node';
import { WebDAVFS } from 'breadfs/webdav';

const wfs = new WebDAVFS('https://dav.mypikpak.net', {
  username: process.env.PIKPAK_USERNAME,
  password: process.env.PIKPAK_PASSWORD
});

const files = await wfs.list('/anime/Heart Catch 光之美少女！/');
files.sort((lhs, rhs) => lhs.basename.localeCompare(rhs.basename));

const tc = files.filter((file) => file.basename.endsWith('.tc.ass'));
for (const file of tc) {
  await file.remove();
}

for (const file of files) {
  const name = file.basename.replace(
    /^.*\[(\d\d)\].*\.(.*)$/,
    'Heart Catch 光之美少女！ S01E$1.$2'
  );
  await file.moveTo(wfs.path(file.dirname, name));
}

console.log(await wfs.list('/anime/Heart Catch 光之美少女！/'));
