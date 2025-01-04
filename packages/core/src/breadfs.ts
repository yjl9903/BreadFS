import pathe from 'pathe';

import {
  RawFileStat,
  BreadFSProvider,
  ListOptions,
  RemoveOptions,
  StatOptions,
  MakeDirectoryOptions,
  ReadStreamOptions,
  WriteStreamOptions,
  ReadFileOptions,
  WriteFileOptions,
  EncodingOptions,
  CopyOptions,
  MoveOptions
} from './provider';
import { BreadFSError } from './error';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type FileStat<P extends BreadFSProvider<string>> = Prettify<
  { path: Path<P> } & Omit<RawFileStat, 'path'>
>;

type AcrossFileStat<T extends string | Path, P extends BreadFSProvider<string>> = T extends Path<
  infer R
>
  ? FileStat<R>
  : FileStat<P>;

type AcrossPath<T extends string | Path, P extends BreadFSProvider<string>> = T extends Path<
  infer R
>
  ? Path<R>
  : Path<P>;

export class BreadFS<P extends BreadFSProvider<string> = BreadFSProvider<string>> {
  public readonly provider: P;

  public constructor(provider: P) {
    this.provider = provider;
  }

  public static of<P extends BreadFSProvider<string>>(provider: P) {
    return new BreadFS<P>(provider);
  }

  public get name(): P['name'] {
    return this.provider.name;
  }

  public path<T extends string | Path>(root: T, ...paths: string[]): AcrossPath<T, P> {
    const ps = pathe.join(typeof root === 'string' ? root : root.path, ...paths);
    if (typeof root === 'string') {
      return new Path(this, ps) as AcrossPath<T, P>;
    } else {
      return new Path(root.fs, ps) as AcrossPath<T, P>;
    }
  }

  public createReadStream(
    path: string | Path,
    options: ReadStreamOptions = {}
  ): ReadableStream<Uint8Array> {
    return this.runSync(() =>
      this.matchFS(
        path,
        (p) => this.provider.createReadStream(p, options),
        (p) => p.fs.createReadStream(p, options)
      )
    );
  }

  public createWriteStream(
    path: string | Path,
    options: WriteStreamOptions = {}
  ): WritableStream<Uint8Array> {
    return this.runSync(() =>
      this.matchFS(
        path,
        (p) => this.provider.createWriteStream(p, options),
        (p) => p.fs.createWriteStream(p, options)
      )
    );
  }

  public async mkdir<T extends string | Path>(
    path: T,
    options: MakeDirectoryOptions = {}
  ): Promise<void> {
    const resolved: MakeDirectoryOptions = { recursive: true, ...options };
    await this.runAsync(() =>
      this.matchFS(
        path,
        async (p) => await this.provider.mkdir(p, resolved),
        async (p) => p.fs.mkdir(p, resolved)
      )
    );
  }

  public async readFile(path: string | Path, options: ReadFileOptions = {}): Promise<Uint8Array> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.readFile(p, options),
        (p) => p.fs.readFile(p, options)
      )
    );
  }

  public async readText(
    path: string | Path,
    options: BufferEncoding | EncodingOptions = 'utf-8'
  ): Promise<string> {
    return this.runAsync(async () => {
      // @ts-expect-error
      const resolved: EncodingOptions =
        typeof options === 'string' ? { encoding: options } : options;
      if (this.provider.readText) {
        return this.matchFS(
          path,
          (p) => this.provider.readText!(p, resolved),
          (p) => p.fs.readText!(p, resolved)
        );
      } else {
        const content = await this.readFile(path, resolved);
        const encoding = typeof options === 'string' ? options : options.encoding;
        const decoder = new TextDecoder(encoding);
        return decoder.decode(content);
      }
    });
  }

  public async writeFile(
    path: string | Path,
    buffer: Buffer | Uint8Array,
    options: WriteFileOptions = {}
  ): Promise<void> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.writeFile(p, buffer, options),
        (p) => p.fs.writeFile(p, buffer, options)
      )
    );
  }

  public async writeText(
    path: string | Path,
    content: string,
    options: BufferEncoding | EncodingOptions = 'utf-8'
  ): Promise<void> {
    await this.runAsync(async () => {
      if (this.provider.writeText) {
        // @ts-expect-error
        const resolved: EncodingOptions =
          typeof options === 'string' ? { encoding: options } : options;
        await this.matchFS(
          path,
          (p) => this.provider.writeText!(p, content, resolved),
          (p) => p.fs.writeText!(p, content, resolved)
        );
      } else {
        // const encoding = typeof options === 'string' ? options : options.encoding;
        const buffer = new TextEncoder().encode(content);
        await this.writeFile(path, buffer.buffer as any);
      }
    });
  }

  /**
   * Remove a file or a directory recursively.
   *
   * @param path A file or a directory
   * @param options
   * @returns
   */
  public async remove(path: string | Path, options: RemoveOptions = {}): Promise<void> {
    const resolved: RemoveOptions = { recursive: true, force: true, ...options };
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.remove(p, resolved),
        (p) => p.fs.remove(p, resolved)
      )
    );
  }

  /**
   * Copy a file or directory, even across file systems.
   *
   * @param src Note that if `src` is a directory it will move everything inside of this directory, not the entire directory itself.
   * @param dst Note that if `src` is a file, `dst` cannot be a directory.
   * @param options
   * @returns
   */
  public async copy(
    src: string | Path,
    dst: string | Path,
    options: CopyOptions = {}
  ): Promise<void> {
    return this.runAsync(() =>
      this.matchFS(
        src,
        async (src) => {
          const dstPath = typeof dst === 'string' ? dst : dst.path;
          if (this.provider.copy && (typeof dst === 'string' || this === dst.fs)) {
            // Copy in the same fs and copy is provided
            await this.provider.copy(src, dstPath, options);
            return;
          }

          // Check overwrite
          if (!options.overwrite && (await this.exists(dst))) {
            throw new Error(`${dst} is existed`);
          }

          const copyFile = async (src: string, dst: string | Path) => {
            const dstStat = await this.stat(dst).catch(() => undefined);
            if (dstStat && !dstStat.isFile()) {
              throw new Error(`Can not copy file to directory ${dst}`);
            }

            if (options.fallback?.stream) {
              // Use stream to implement copy
              const read = this.createReadStream(src, options.fallback.stream.read);

              const writeOptions = { ...options.fallback.stream.write };
              const srcStat =
                options.fallback.stream?.contentLength || options.fallback.stream?.onProgress
                  ? await this.stat(src).catch(() => undefined)
                  : undefined;
              if (options.fallback.stream?.contentLength) {
                if (srcStat && typeof srcStat.size === 'number') {
                  writeOptions.contentLength = srcStat.size;
                } else if (srcStat && typeof srcStat.size === 'bigint') {
                  writeOptions.contentLength = Number(srcStat.size);
                } else {
                  throw new Error(`Can not get file size of ${src}`);
                }
              }

              const write =
                typeof dst === 'string'
                  ? this.createWriteStream(dst, writeOptions)
                  : dst.fs.createWriteStream(dst, writeOptions);

              if (options.fallback.stream.onProgress) {
                let transformed = 0;
                const total = srcStat?.size ? Number(srcStat.size) : undefined;
                const onProgress = options.fallback.stream.onProgress;

                await read
                  .pipeThrough(
                    new TransformStream({
                      start() {
                        transformed = 0;
                      },
                      transform(chunk, controller) {
                        try {
                          transformed += chunk.length;
                          onProgress({ src, current: transformed, total });
                        } catch {
                        } finally {
                          controller.enqueue(chunk);
                        }
                      }
                    })
                  )
                  .pipeTo(write);
              } else {
                await read.pipeTo(write);
              }
            } else {
              // Use readFile and writeFile to implement copy
              const contents = await this.readFile(src, options.fallback?.file?.read);
              await this.writeFile(dst, contents, options.fallback?.file?.write);
            }
          };

          const srcStat = await this.stat(src);
          if (srcStat.isFile()) {
            await copyFile(src, dst);
          } else if (srcStat.isDirectory()) {
            const copyDirectory = async (src: string, dst: Path) => {
              const dstStat = await this.stat(dst).catch(() => undefined);
              if (dstStat) {
                if (!dstStat.isDirectory()) {
                  throw new Error(`Can not copy directory to file ${dst}`);
                }
              } else {
                await this.mkdir(dst);
              }
              const files = await this.listStat(src);
              await Promise.all(
                files.map(async (file): Promise<void> => {
                  const name = file.path.basename;
                  if (file.isDirectory()) {
                    await copyDirectory(file.path.path, dst.join(name));
                  } else if (file.isFile()) {
                    await copyFile(file.path.path, dst.join(name));
                  } else {
                    throw new Error('Not support copy other file types');
                  }
                })
              );
            };

            await copyDirectory(src, typeof dst === 'string' ? new Path(this, dst) : dst);
          } else {
            throw new Error('Not support copy other file types');
          }
        },
        (src) => src.fs.copy(src, dst)
      )
    );
  }

  /**
   * Moves a file or directory, even across file systems.
   *
   * @param src Note that if `src` is a directory it will copy everything inside of this directory, not the entire directory itself.
   * @param dst Note that when `src` is a file, `dest` must be a file and when `src` is a directory, `dest` must be a directory.
   * @param options
   * @returns
   */
  public async move(
    src: string | Path,
    dst: string | Path,
    options: MoveOptions = {}
  ): Promise<void> {
    return this.runAsync(() =>
      this.matchFS(
        src,
        async (src) => {
          const dstPath = typeof dst === 'string' ? dst : dst.path;
          if (this.provider.move && (typeof dst === 'string' || this === dst.fs)) {
            // Copy in the same fs and move is provided
            await this.provider.move(src, dstPath, options);
            return;
          }

          // Check overwrite
          if (!options.overwrite && (await this.exists(dst))) {
            throw new Error(`${dst} is existed`);
          }

          const moveFile = async (src: string, dst: string | Path) => {
            const dstStat = await this.stat(dst).catch(() => undefined);
            if (dstStat && !dstStat.isFile()) {
              throw new Error(`Can not move file to directory ${dst}`);
            }

            if (options.fallback?.stream) {
              // Use stream to implement move file
              const read = this.createReadStream(src, options.fallback.stream.read);

              const writeOptions = { ...options.fallback.stream.write };
              const srcStat =
                options.fallback.stream?.contentLength || options.fallback.stream?.onProgress
                  ? await this.stat(src).catch(() => undefined)
                  : undefined;
              if (options.fallback.stream?.contentLength) {
                if (srcStat && typeof srcStat.size === 'number') {
                  writeOptions.contentLength = srcStat.size;
                } else if (srcStat && typeof srcStat.size === 'bigint') {
                  writeOptions.contentLength = Number(srcStat.size);
                } else {
                  throw new Error(`Can not get file size of ${src}`);
                }
              }
              const write =
                typeof dst === 'string'
                  ? this.createWriteStream(dst, writeOptions)
                  : dst.fs.createWriteStream(dst, writeOptions);

              if (options.fallback.stream.onProgress) {
                let transformed = 0;
                const total = srcStat?.size ? Number(srcStat.size) : undefined;
                const onProgress = options.fallback.stream.onProgress;

                await read
                  .pipeThrough(
                    new TransformStream({
                      start() {
                        transformed = 0;
                      },
                      transform(chunk, controller) {
                        try {
                          transformed += chunk.length;
                          onProgress({ src, current: transformed, total });
                        } catch {
                        } finally {
                          controller.enqueue(chunk);
                        }
                      }
                    })
                  )
                  .pipeTo(write);
              } else {
                await read.pipeTo(write);
              }

              await this.remove(src, options.fallback.file?.remove);
            } else {
              // Use readFile and writeFile to implement move file
              const contents = await this.readFile(src, options.fallback?.file?.read);
              await this.writeFile(dst, contents, options.fallback?.file?.write);
              await this.remove(src, options.fallback?.file?.remove);
            }
          };

          const srcStat = await this.stat(src);
          if (srcStat.isFile()) {
            await moveFile(src, dst);
          } else if (srcStat.isDirectory()) {
            const moveDirectory = async (src: string, dst: Path) => {
              const dstStat = await this.stat(dst).catch(() => undefined);
              if (dstStat) {
                if (!dstStat.isDirectory()) {
                  throw new Error(`Can not move directory to file ${dst}`);
                }
              } else {
                await this.mkdir(dst);
              }
              const files = await this.listStat(src);
              await Promise.all(
                files.map(async (file): Promise<void> => {
                  const name = file.path.basename;
                  if (file.isDirectory()) {
                    await moveDirectory(file.path.path, dst.join(name));
                  } else if (file.isFile()) {
                    await moveFile(file.path.path, dst.join(name));
                  } else {
                    throw new Error('Not support move other file types');
                  }
                })
              );
              await this.remove(src, options.fallback?.file?.remove);
            };

            await moveDirectory(src, typeof dst === 'string' ? new Path(this, dst) : dst);
          } else {
            throw new Error('Not support move other file types');
          }
        },
        (src) => src.fs.copy(src, dst)
      )
    );
  }

  public async exists(path: string | Path): Promise<boolean> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.exists(p),
        (p) => p.fs.exists(p)
      )
    );
  }

  public async stat<T extends string | Path>(
    path: T,
    options: StatOptions = {}
  ): Promise<AcrossFileStat<T, P>> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        async (p) => {
          const stat = (await this.provider.stat(p, options)) as unknown as AcrossFileStat<T, P>;
          stat.path = typeof path === 'string' ? new Path(this, p) : path;
          return stat;
        },
        async (p) => {
          const stat = (await p.fs.stat(p, options)) as AcrossFileStat<T, P>;
          stat.path = p;
          return stat;
        }
      )
    );
  }

  public async list<T extends string | Path>(
    path: T,
    options: ListOptions = {}
  ): Promise<AcrossPath<T, P>[]> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        async (root) => {
          const files = await this.provider.list(root, options);
          return files.map((sp) => this.path(sp) as AcrossPath<T, P>);
        },
        (root) => root.fs.list<T>(root as T, options) as Promise<AcrossPath<T, P>[]>
      )
    );
  }

  public async listStat<T extends string | Path>(
    path: T,
    options: ListOptions = {}
  ): Promise<AcrossFileStat<T, P>[]> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        async (root) => {
          if (this.provider.listStat) {
            const files = await this.provider.listStat(root, options);
            return files.map((file) => {
              const stat = file as unknown as AcrossFileStat<T, P>;
              stat.path = this.path(file.path);
              return stat as AcrossFileStat<T, P>;
            });
          }
          const files = await this.list(path, options);
          return (await Promise.all(files.map((file) => this.stat(file)))) as AcrossFileStat<
            T,
            P
          >[];
        },
        (root) => root.fs.listStat(root, options) as Promise<AcrossFileStat<T, P>[]>
      )
    );
  }

  // ---
  private matchFS<T extends string | Path, R extends {}>(
    path: T,
    match: (path: string) => R,
    miss: (path: Path) => R
  ) {
    if (typeof path === 'string') {
      return match(path);
    } else if (path.fs === this) {
      return match(path.path);
    } else {
      return miss(path);
    }
  }

  private runSync<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw new BreadFSError(error);
    }
  }

  private async runAsync<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new BreadFSError(error);
    }
  }
  // ---
}

export class Path<P extends BreadFSProvider<string> = BreadFSProvider<string>> {
  private readonly _fs: BreadFS<P>;

  private readonly _path: string;

  public constructor(fs: BreadFS<P>, path: string) {
    this._fs = fs;
    this._path = path;
  }

  public get fs(): BreadFS<P> {
    return this._fs;
  }

  public get path(): string {
    return this._path;
  }

  // Path related
  public get basename(): string {
    return pathe.basename(this._path);
  }

  public get dirname(): string {
    return pathe.dirname(this._path);
  }

  public get extname(): string {
    return pathe.extname(this._path);
  }

  public join(...pieces: string[]): Path<P> {
    return new Path(this._fs, pathe.join(this._path, ...pieces));
  }

  public resolve(...pieces: string[]): Path<P> {
    return new Path(this._fs, pathe.resolve(this._path, ...pieces));
  }

  // File system access related
  public createReadStream(options: ReadStreamOptions = {}) {
    return this._fs.createReadStream(this._path, options);
  }

  public createWriteStream(options: WriteStreamOptions = {}) {
    return this._fs.createWriteStream(this._path, options);
  }

  public async mkdir(options: MakeDirectoryOptions = {}): Promise<void> {
    await this._fs.mkdir(this._path, options);
  }

  public async ensureDir(options: MakeDirectoryOptions = {}): Promise<void> {
    await this._fs.mkdir(this._path, options);
  }

  public async stat(options: StatOptions = {}): Promise<FileStat<P>> {
    return this._fs.stat(this._path, options);
  }

  public async isFile(): Promise<boolean> {
    return (await this.stat()).isFile();
  }

  public async isDirectory(): Promise<boolean> {
    return (await this.stat()).isDirectory();
  }

  public async isSymbolicLink(): Promise<boolean> {
    return (await this.stat()).isSymbolicLink();
  }

  public async exists(): Promise<boolean> {
    return await this._fs.exists(this._path);
  }

  public async readFile(options: ReadFileOptions = {}): Promise<Uint8Array> {
    return this._fs.readFile(this._path, options);
  }

  public async readText(options: BufferEncoding | EncodingOptions = 'utf-8'): Promise<string> {
    return this._fs.readText(this._path, options);
  }

  public async readJSON<T>(): Promise<T> {
    const content = await this._fs.readText(this._path);
    return JSON.parse(content);
  }

  public async writeFile(buffer: Uint8Array, options: WriteFileOptions = {}): Promise<void> {
    return this._fs.writeFile(this._path, buffer, options);
  }

  public async writeText(
    content: string,
    options: BufferEncoding | EncodingOptions = 'utf-8'
  ): Promise<void> {
    await this._fs.writeText(this._path, content, options);
  }

  public async writeJSON<T>(
    value: T,
    replacer?: Parameters<typeof JSON.stringify>[1],
    space?: Parameters<typeof JSON.stringify>[2]
  ): Promise<void> {
    const content = JSON.stringify(value, replacer, space);
    await this._fs.writeText(this._path, content);
  }

  public async copyTo(dst: string | Path, options: CopyOptions = {}): Promise<void> {
    await this._fs.copy(this, dst, options);
  }

  public async moveTo(dst: string | Path, options: MoveOptions = {}): Promise<void> {
    await this._fs.move(this, dst, options);
  }

  public async remove(options: RemoveOptions = {}): Promise<void> {
    await this._fs.remove(this._path, options);
  }

  public async list(options: ListOptions = {}): Promise<Path<P>[]> {
    return await this._fs.list(this._path, options);
  }

  public async listStat(options: ListOptions = {}): Promise<FileStat<P>[]> {
    return await this._fs.listStat(this._path, options);
  }

  // Utils
  public toString(): string {
    return this._path;
  }
}
