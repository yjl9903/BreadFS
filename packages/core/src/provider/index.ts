import type {
  FileStat,
  MakeDirectoryOptions,
  RmOptions,
  ListOptions,
  StatOptions,
  ReadStreamOptions,
  WriteStreamOptions,
  EncodingOptions,
  WriteFileOptions,
  ReadFileOptions
} from './types';

export type * from './types';

export interface BreadFSProvider {
  readonly name: string;

  mkdir: (path: string, options: MakeDirectoryOptions) => Promise<void>;

  createReadStream: (path: string, options: ReadStreamOptions) => ReadableStream<Uint8Array>;

  createWriteStream: (path: string, options: WriteStreamOptions) => WritableStream<Uint8Array>;

  readFile: (path: string, options: ReadFileOptions) => Promise<Buffer>;

  readText?: (path: string, options: EncodingOptions) => Promise<string>;

  writeFile: (path: string, stream: ReadableStream, options: WriteFileOptions) => Promise<void>;

  writeText?: (path: string, content: string, options: EncodingOptions) => Promise<void>;

  copyFile?: (src: string, dst: string) => Promise<void>;

  remove: (path: string, options: RmOptions) => Promise<void>;

  stat: (path: string, options: StatOptions) => Promise<FileStat>;

  exists: (path: string) => Promise<boolean>;

  list: (path: string, options: ListOptions) => Promise<string[]>;

  walk?: (path: string) => AsyncIterable<string>;
}
