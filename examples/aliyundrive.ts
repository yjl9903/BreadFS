import 'dotenv/config';

import { chat } from 'breadc';
import { fs as nfs } from 'breadfs/node';
import { AliyundriveFS } from 'breadfs/aliyundrive';

const logger = chat();

const afs = new AliyundriveFS({
  refresh: {
    token: process.env.ALIYUNDRIVE_REFRESH_TOKEN!,
    endpoint: 'https://api.oplist.org/alicloud/renewapi'
  }
});

const resp = await afs.list('/anime/');
console.log(resp);

const content = await nfs
  .path(
    '.temp/[Nekomoe kissaten&LoliHouse] Sousou no Frieren - 32 [WebRip 1080p HEVC-10bit AAC ASSx2].mkv'
  )
  .readFile();
await afs.mkdir('/test/');

const target = '葬送的芙莉莲 S01E32.mkv';
const progress = logger.progress(target, {
  template: ['{message}', '{bar} | {percent}% {size}'],
  fields: {
    size(ctx) {
      if (!ctx.state.value || !ctx.state.total) {
        return '';
      }
      const format = (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };
      return `${format(ctx.state.value)} / ${format(ctx.state.total)}`;
    }
  }
});

await afs.path(`/test/${target}`).writeFile(content, {
  onProgress(payload) {
    progress.setState({ value: payload.current, total: payload.total });
  }
});
progress.remove();
logger.log(`Uploaded: Sousou no Frieren - 32.mkv`);
