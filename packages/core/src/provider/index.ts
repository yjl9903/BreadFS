import type { ReadableStream, WritableStream } from 'node:stream/web';

import type { FileStat, MakeDirectoryOptions, RmOptions, ListOptions, StatOptions } from './types';

export type * from './types';

export interface BreadFSProvider {
  readonly name: string;

  mkdir: (path: string, options: MakeDirectoryOptions) => Promise<void>;

  createReadStream: (path: string) => ReadableStream<any>;

  createWriteStream: (path: string) => WritableStream<any>;

  readFile: (path: string) => Promise<Buffer>;

  readText?: (path: string) => Promise<string>;

  writeFile: (path: string, stream: ReadableStream) => Promise<void>;

  writeText?: (path: string, content: string) => Promise<void>;

  copyFile?: (src: string, dst: string) => Promise<void>;

  remove: (path: string, options: RmOptions) => Promise<void>;

  stat: (path: string, options: StatOptions) => Promise<FileStat>;

  exists: (path: string) => Promise<boolean>;

  list: (path: string, options: ListOptions) => Promise<string[]>;

  walk?: (path: string) => AsyncIterable<string>;
}