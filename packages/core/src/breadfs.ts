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
  EncodingOptions
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

  public path(...path: (string | Path)[]): Path {
    const ps = pathe.join(...path.map((p) => (typeof p === 'string' ? p : p.path)));
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
    stream: ReadableStream<Uint8Array>,
    options: WriteFileOptions = {}
  ): Promise<void> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.writeFile(p, stream, options),
        (p) => p.fs.writeFile(p, stream, options)
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
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(content);
            controller.close();
          }
        }).pipeThrough(new TextEncoderStream());
        await this.writeFile(path, stream);
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

  public async stat(options: StatOptions = {}): Promise<FileStat> {
    return this._fs.stat(this._path, options);
  }

  public async isFile(): Promise<boolean> {
    return (await this.stat()).isFile;
  }

  public async isDirectory(): Promise<boolean> {
    return (await this.stat()).isDirectory;
  }

  public async exists(): Promise<boolean> {
    return await this._fs.exists(this._path);
  }

  public readFile(options: ReadFileOptions = {}) {
    return this._fs.readFile(this._path, options);
  }

  public readText(options: BufferEncoding | EncodingOptions = 'utf-8') {
    return this._fs.readText(this._path, options);
  }

  public writeFile(stream: ReadableStream, options: WriteFileOptions = {}) {
    return this._fs.writeFile(this._path, stream, options);
  }

  public writeText(content: string, options: BufferEncoding | EncodingOptions = 'utf-8') {
    return this._fs.writeText(this._path, content, options);
  }

  public copyTo(dst: string | Path) {}

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
