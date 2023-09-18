import type { ReadableStream, WritableStream } from 'node:stream/web';

import pathe from 'pathe';

import { BreadFSError } from './error';
import {
  BreadFSProvider,
  FileStat,
  ListOptions,
  MakeDirectoryOptions,
  RmOptions
} from './provider';

export class BreadFS {
  public readonly provider: BreadFSProvider;

  public constructor(provider: BreadFSProvider) {
    this.provider = provider;
  }

  public static of(provider: BreadFSProvider) {
    return new BreadFS(provider);
  }

  public path(...path: string[]): Path {
    return new Path(this, pathe.join(...path));
  }

  public createReadStream(path: string | Path): ReadableStream<any> {
    return this.runSync(() =>
      this.matchFS(
        path,
        (p) => this.provider.createReadStream(p),
        (p) => p.fs.createReadStream(p)
      )
    );
  }

  public createWriteStream(path: string | Path): WritableStream<any> {
    return this.runSync(() =>
      this.matchFS(
        path,
        (p) => this.provider.createWriteStream(p),
        (p) => p.fs.createWriteStream(p)
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

  public readFile(path: string | Path): ReadableStream {
    return this.runSync(() =>
      this.matchFS(
        path,
        (p) => this.provider.readFile(p),
        (p) => p.fs.readFile(p)
      )
    );
  }

  public async writeFile(path: string | Path, stream: ReadableStream): Promise<void> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.writeFile(p, stream),
        (p) => p.fs.writeFile(p, stream)
      )
    );
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

  public async stat(path: string | Path): Promise<FileStat> {
    return this.runAsync(() =>
      this.matchFS(
        path,
        (p) => this.provider.stat(p),
        (p) => p.fs.stat(p)
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
  public async mkdir(options: MakeDirectoryOptions = {}): Promise<void> {
    await this._fs.mkdir(this._path, options);
  }

  public async stat(): Promise<FileStat> {
    return this._fs.stat(this._path);
  }

  public async isDirectory(): Promise<boolean> {
    return (await this.stat()).isDirectory;
  }

  public async isFile(): Promise<boolean> {
    return (await this.stat()).isDirectory;
  }

  public async exists(): Promise<boolean> {
    return await this._fs.exists(this._path);
  }

  public readFile() {
    return this._fs.readFile(this._path);
  }

  public readText() {}

  public writeFile(stream: ReadableStream) {
    return this._fs.writeFile(this._path, stream);
  }

  public writeText() {}

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
