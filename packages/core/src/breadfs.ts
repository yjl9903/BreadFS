import pathe from 'pathe';

import {
  FileStat,
  BreadFSProvider,
  ListOptions,
  RmOptions,
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

export class BreadFS {
  public readonly provider: BreadFSProvider;

  public constructor(provider: BreadFSProvider) {
    this.provider = provider;
  }

  public static of(provider: BreadFSProvider) {
    return new BreadFS(provider);
  }

  public path(root: string | Path, ...paths: string[]): Path {
    const ps = pathe.join(typeof root === 'string' ? root : root.path, ...paths);
    return new Path(this, ps);
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

  public async mkdir(path: string | Path, options: MakeDirectoryOptions = {}): Promise<Path> {
    const resolved: MakeDirectoryOptions = { recursive: true, ...options };
    return this.runAsync(() =>
      this.matchFS(
        path,
        async (p) => (await this.provider.mkdir(p, resolved), this.path(p)),
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
      if (this.provider.readText) {
        const resolved: EncodingOptions =
          typeof options === 'string' ? { encoding: options } : options;
        return this.matchFS(
          path,
          (p) => this.provider.readText!(p, resolved),
          (p) => p.fs.readText!(p, resolved)
        );
      } else {
        const content = await this.readFile(path, options);
        const encoding = typeof options === 'string' ? options : options.encoding;
        const decoder = new TextDecoder(encoding);
        return decoder.decode(content);
      }
    });
  }

  public async writeFile(
    path: string | Path,
    buffer: Uint8Array,
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
        await this.writeFile(path, buffer);
      }
    });
  }

  public async remove(path: string | Path, options: RmOptions = {}): Promise<void> {
    const resolved: RmOptions = { recursive: true, force: true, ...options };
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.remove(p, resolved),
        (p) => p.fs.remove(p, resolved)
      )
    );
  }

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

          const srcStat = await this.stat(src);
          if (srcStat.isFile()) {
            // const read = this.createReadStream(src);
            // const write =
            //   typeof dst === 'string' ? this.createWriteStream(dst) : dst.fs.createWriteStream(dst);
            // await read.pipeTo(write);

            // Use readFile and writeFile to implement copy
            const contents = await this.readFile(src);
            await this.writeFile(dst, contents, {});
          } else if (srcStat.isDirectory()) {
            // TODO
            throw new Error('Not support copy directory');
          } else {
            throw new Error('Not support copy other file types');
          }
        },
        (src) => src.fs.copy(src, dst)
      )
    );
  }

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

          const srcStat = await this.stat(src);
          if (srcStat.isFile()) {
            // const read = this.createReadStream(src);
            // const write =
            //   typeof dst === 'string' ? this.createWriteStream(dst) : dst.fs.createWriteStream(dst);
            // await read.pipeTo(write);
            // await this.remove(src);

            // Use readFile and writeFile to implement move file
            const contents = await this.readFile(src);
            await this.writeFile(dst, contents, {});
            await this.remove(src);
          } else if (srcStat.isDirectory()) {
            // TODO
            throw new Error('Not support move directory');
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

  public async stat(path: string | Path, options: StatOptions = {}): Promise<FileStat> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.stat(p, options),
        (p) => p.fs.stat(p, options)
      )
    );
  }

  public async list(path: string | Path, options: ListOptions = {}): Promise<Path[]> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        async (root) => (await this.provider.list(root, options)).map((sp) => this.path(root, sp)),
        (root) => root.fs.list(root, options)
      )
    );
  }

  // ---
  private matchFS<T extends {}>(
    path: string | Path,
    match: (path: string) => T,
    miss: (path: Path) => T
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

export class Path {
  private readonly _fs: BreadFS;

  private readonly _path: string;

  public constructor(fs: BreadFS, path: string) {
    this._fs = fs;
    this._path = path;
  }

  public get fs() {
    return this._fs;
  }

  public get path() {
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

  public join(...pieces: string[]): Path {
    return new Path(this._fs, pathe.join(this._path, ...pieces));
  }

  public resolve(...pieces: string[]): Path {
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

  public async stat(options: StatOptions = {}): Promise<FileStat> {
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

  public async readFile(options: ReadFileOptions = {}) {
    return this._fs.readFile(this._path, options);
  }

  public async readText(options: BufferEncoding | EncodingOptions = 'utf-8') {
    return this._fs.readText(this._path, options);
  }

  public async writeFile(buffer: Uint8Array, options: WriteFileOptions = {}) {
    return this._fs.writeFile(this._path, buffer, options);
  }

  public async writeText(content: string, options: BufferEncoding | EncodingOptions = 'utf-8') {
    return this._fs.writeText(this._path, content, options);
  }

  public async copyTo(dst: string | Path, options: CopyOptions = {}) {
    return this._fs.copy(this, dst, options);
  }

  public async moveTo(dst: string | Path, options: MoveOptions = {}) {
    return this._fs.move(this, dst, options);
  }

  public async remove(options: RmOptions = {}): Promise<void> {
    await this._fs.remove(this._path, options);
  }

  public async list(options: ListOptions = {}): Promise<Path[]> {
    return await this._fs.list(this._path, options);
  }

  // Utils
  public toString() {
    return this._path;
  }
}
