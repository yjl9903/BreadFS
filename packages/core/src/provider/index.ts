import type { ReadableStream, WritableStream } from 'node:stream/web';

import type { MakeDirectoryOptions, RmOptions, FileStat } from './types';

export type * from './types';

export interface BreadFSProvider {
  readonly name: string;

  mkdir: (path: string, options: MakeDirectoryOptions) => Promise<void>;

  createReadStream: (path: string) => ReadableStream<any>;

  createWriteStream: (path: string) => WritableStream<any>;

  readFile: (path: string) => ReadableStream;

  readText?: (path: string) => string;

  writeFile: (path: string, stream: ReadableStream) => Promise<void>;

  writeText?: (path: string) => Promise<void>;

  copyFile?: (src: string, dst: string) => Promise<void>;

  remove: (path: string, options: RmOptions) => Promise<void>;

  stat: (path: string) => Promise<FileStat>;

  exists: (path: string) => Promise<boolean>;

  list: (path: string) => Promise<string[]>;

  walk?: (path: string) => AsyncIterable<string>;
}
