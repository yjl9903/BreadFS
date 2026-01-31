import 'dotenv/config';

import { BreadFS } from 'breadfs';

import { AliyunDriveProvider } from '../packages/aliyundrive/src/index';

const fs = new BreadFS(
  new AliyunDriveProvider({
    refresh: { token: process.env.ALIYUNDRIVE_REFRESH_TOKEN! }
  })
);

const resp = await fs.list('/anime/');
console.log(resp);

await fs.mkdir('/test/data/');
await fs.writeText('/test/data/test.txt', 'hello world');
console.log(await fs.readText('/test/data/test.txt'));
