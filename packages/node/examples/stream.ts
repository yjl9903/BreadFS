import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BreadFS } from '@breadfs/core';
import { NodeFS } from '@breadfs/node';

const __dirname = path.join(fileURLToPath(import.meta.url), '../');

const fs = BreadFS.of(NodeFS);
const self = fs.path(__dirname, '../../../pnpm-lock.yaml');

const stream = self.createReadStream();
console.log('Create stream', self);
for await (const chunk of stream) {
  console.log(chunk);
}
