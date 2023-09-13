import { ReadableStream, WritableStream } from 'node:stream/web';

export abstract class BreadFSProvider {
  abstract mkdir(path: string, options?: MakeDirectoryOptions): Promise<void>;

  abstract createReadStream(path: string): ReadableStream<any>;

  abstract createWriteStream(path: string): WritableStream<any>;

  abstract readFile(path: string): ReadableStream;

  abstract writeFile(path: string, stream: ReadableStream): Promise<void>;

  abstract remove(path: string): Promise<void>;

  abstract stat(path: string): Promise<{}>;

  abstract list(path: string): Promise<string>;

  abstract walk(path: string): AsyncIterable<{}>;
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
