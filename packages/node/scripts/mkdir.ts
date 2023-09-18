import { BreadFS } from '@breadfs/core';
import { NodeFS } from '@breadfs/node';

const fs = BreadFS.of(NodeFS);
const tempdir = fs.path('temp/directory');
await tempdir.mkdir({ recursive: true });
