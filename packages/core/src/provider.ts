import type { ReadableStream, WritableStream } from 'node:stream/web';

export interface BreadFSProvider {
  mkdir: (path: string, options?: MakeDirectoryOptions) => Promise<void>;

  createReadStream: (path: string) => ReadableStream<any>;

  createWriteStream: (path: string) => WritableStream<any>;

  readFile: (path: string) => ReadableStream;

  readText?: (path: string) => string;

  writeFile: (path: string, stream: ReadableStream) => Promise<void>;

  writeText?: (path: string) => Promise<void>;

  copyFile?: (src: string, dst: string) => Promise<void>;

  remove: (path: string) => Promise<void>;

  stat: (path: string) => Promise<FileStat>;

  exists: (path: string) => Promise<boolean>;

  list: (path: string) => Promise<string[]>;

  walk?: (path: string) => AsyncIterable<string>;
}

export interface MakeDirectoryOptions {
  /**
   * Indicates whether parent folders should be created.
   * If a folder was created, the path to the first created folder will be returned.
   * @default false
   */
  recursive?: boolean | undefined;

  /**
   * A file mode. If a string is passed, it is parsed as an octal integer. If not specified
   * @default 0o777
   */
  mode?: number | string | undefined;
}

export interface FileStat {
  size: number | bigint | undefined;

  isDirectory: boolean;

  isFile: boolean;

  mtime: Date | undefined;

  birthtime: Date | undefined;
}
