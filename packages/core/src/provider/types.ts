export interface StreamOptions {}

export interface ReadStreamOptions extends StreamOptions {}

export interface WriteStreamOptions extends StreamOptions {}

export type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';

export interface EncodingOptions {
  encoding?: BufferEncoding;
}

export interface ReadFileOptions {}

export interface WriteFileOptions {}

export interface MakeDirectoryOptions {
  /**
   * Indicates whether parent folders should be created.
   * If a folder was created, the path to the first created folder will be returned.
   * @default true
   */
  recursive?: boolean | undefined;

  /**
   * A file mode. If a string is passed, it is parsed as an octal integer. If not specified
   * @default 0o777
   */
  mode?: number | string | undefined;
}

export interface RmOptions {
  /**
   * When `true`, exceptions will be ignored if `path` does not exist.
   * @default true
   */
  force?: boolean | undefined;

  /**
   * If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
   * `EPERM` error is encountered, Node.js will retry the operation with a linear
   * backoff wait of `retryDelay` ms longer on each try. This option represents the
   * number of retries. This option is ignored if the `recursive` option is not
   * `true`.
   * @default 0
   */
  maxRetries?: number | undefined;

  /**
   * If `true`, perform a recursive directory removal. In
   * recursive mode, operations are retried on failure.
   * @default true
   */
  recursive?: boolean | undefined;

  /**
   * The amount of time in milliseconds to wait between retries.
   * This option is ignored if the `recursive` option is not `true`.
   * @default 100
   */
  retryDelay?: number | undefined;
}

export interface CopyOptions {
  /**
   * Dereference symlinks.
   * @default false
   */
  dereference?: boolean | undefined;

  /**
   * Overwrite existing file or directory.
   * _Note that the copy operation will silently fail if you set this to `false` and the destination exists._
   * Use the `errorOnExist` option to change this behavior.
   * @default true
   */
  overwrite?: boolean | undefined;

  /**
   * When `true`, will set last modification and access times to the ones of the original source files.
   * When `false`, timestamp behavior is OS-dependent.
   * @default false
   */
  preserveTimestamps?: boolean | undefined;

  /**
   * When `overwrite` is `false` and the destination exists, throw an error.
   * @default false
   */
  errorOnExist?: boolean | undefined;

  /**
   * Function to filter copied files/directories. Return `true` to copy the item, `false` to ignore it.
   * Can also return a `Promise` that resolves to `true` or `false` (or pass in an `async` function).
   */
  // filter?: CopyFilterSync | CopyFilterAsync | undefined;
}

export interface MoveOptions {
  /**
   * Overwrite existing file or directory.
   * @default false
   */
  overwrite?: boolean | undefined;

  /**
   * Dereference symlinks.
   * @default false
   */
  dereference?: boolean | undefined;
}

export interface StatOptions {
  bigint?: boolean | undefined;
}

export interface ListOptions {
  withFileTypes?: false | undefined;

  recursive?: boolean | undefined;
}

export interface FileStat {
  size: number | bigint | undefined;

  isDirectory: boolean;

  isFile: boolean;

  mtime: Date | undefined;

  birthtime: Date | undefined;
}
