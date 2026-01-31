import type {
  RawFileStat,
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

export interface BreadFSProvider<T extends string> {
  readonly name: T;

  mkdir: (path: string, options: MakeDirectoryOptions) => Promise<void>;

  mkdirSync?: (path: string, options: MakeDirectoryOptions) => void;

  createReadStream: (path: string, options: ReadStreamOptions) => ReadableStream<Uint8Array>;

  createWriteStream: (path: string, options: WriteStreamOptions) => WritableStream<Uint8Array>;

  readFile: (path: string, options: ReadFileOptions) => Promise<Uint8Array>;

  readFileSync?: (path: string, options: ReadFileOptions) => Uint8Array;

  readText?: (path: string, options: EncodingOptions) => Promise<string>;

  readTextSync?: (path: string, options: EncodingOptions) => string;

  writeFile: (
    path: string,
    buffer: Buffer | Uint8Array,
    options: WriteFileOptions
  ) => Promise<void>;

  writeFileSync?: (path: string, buffer: Buffer | Uint8Array, options: WriteFileOptions) => void;

  writeText?: (path: string, content: string, options: EncodingOptions) => Promise<void>;

  writeTextSync?: (path: string, content: string, options: EncodingOptions) => void;

  copy?: (src: string, dst: string, options: CopyOptions) => Promise<void>;

  copySync?: (src: string, dst: string, options: CopyOptions) => void;

  move?: (src: string, dst: string, options: MoveOptions) => Promise<void>;

  moveSync?: (src: string, dst: string, options: MoveOptions) => void;

  remove: (path: string, options: RemoveOptions) => Promise<void>;

  removeSync?: (path: string, options: RemoveOptions) => void;

  stat: (path: string, options: StatOptions) => Promise<RawFileStat>;

  statSync?: (path: string, options: StatOptions) => RawFileStat;

  exists: (path: string) => Promise<boolean>;

  existsSync?: (path: string) => boolean;

  list: (path: string, options: ListOptions) => Promise<string[]>;

  listSync?: (path: string, options: ListOptions) => string[];

  listStat?: (path: string, options: ListOptions) => Promise<RawFileStat[]>;

  listStatSync?: (path: string, options: ListOptions) => RawFileStat[];

  walk?: (path: string) => AsyncIterable<string>;
}
