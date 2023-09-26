import type {
  FileStat,
  MakeDirectoryOptions,
  RemoveOptions,
  ListOptions,
  StatOptions,
  ReadStreamOptions,
  WriteStreamOptions,
  EncodingOptions,
  WriteFileOptions,
  ReadFileOptions,
  CopyOptions,
  MoveOptions
} from './types';

export type * from './types';

export interface BreadFSProvider {
  readonly name: string;

  mkdir: (path: string, options: MakeDirectoryOptions) => Promise<void>;

  createReadStream: (path: string, options: ReadStreamOptions) => ReadableStream<Uint8Array>;

  createWriteStream: (path: string, options: WriteStreamOptions) => WritableStream<Uint8Array>;

  readFile: (path: string, options: ReadFileOptions) => Promise<Uint8Array>;

  readText?: (path: string, options: EncodingOptions) => Promise<string>;

  writeFile: (path: string, buffer: Uint8Array, options: WriteFileOptions) => Promise<void>;

  writeText?: (path: string, content: string, options: EncodingOptions) => Promise<void>;

  copy?: (src: string, dst: string, options: CopyOptions) => Promise<void>;

  move?: (src: string, dst: string, options: MoveOptions) => Promise<void>;

  remove: (path: string, options: RemoveOptions) => Promise<void>;

  stat: (path: string, options: StatOptions) => Promise<FileStat>;

  exists: (path: string) => Promise<boolean>;

  list: (path: string, options: ListOptions) => Promise<string[]>;

  walk?: (path: string) => AsyncIterable<string>;
}
