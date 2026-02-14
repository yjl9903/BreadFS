import 'dotenv/config';

import { AliyundriveFS } from 'breadfs/aliyundrive';

const fs = new AliyundriveFS({
  refresh: { token: process.env.ALIYUNDRIVE_REFRESH_TOKEN! }
});

const resp = await fs.list('/anime/');
console.log(resp);

await fs.mkdir('/test/data/');
await fs.writeText('/test/data/test.txt', 'hello world');
console.log(await fs.readText('/test/data/test.txt'));
