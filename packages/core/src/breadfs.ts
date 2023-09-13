import pathe from 'pathe';
import { ReadableStream, WritableStream } from 'node:stream/web';

import { BreadFSProvider } from './provider';

export class BreadFS {
  public readonly provider: BreadFSProvider;

  public constructor(provider: BreadFSProvider) {
    this.provider = provider;
  }

  public static of(provider: BreadFSProvider) {
    return new BreadFS(provider);
  }

  public path(path: string): Path {
    return new Path(this, path);
  }

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

  public async mkdir(path: string | Path): Promise<Path> {
    return this.matchFS(
      path,
      async (p) => (await this.provider.mkdir(p), this.path(p)),
      async (p) => p.fs.mkdir(p)
    );
  }

  public createReadStream(path: string | Path): ReadableStream<any> {
    return this.matchFS(
      path,
      (p) => this.provider.createReadStream(p),
      (p) => p.fs.createReadStream(p)
    );
  }

  public createWriteStream(path: string): WritableStream<any> {
    return this.provider.createWriteStream(path);
  }

  public readFile(path: string): ReadableStream {
    return this.provider.readFile(path);
  }

  public writeFile(path: string, stream: ReadableStream): Promise<void> {
    return this.provider.writeFile(path, stream);
  }

  public remove(path: string): Promise<void> {
    return this.provider.remove(path);
  }

  public stat(path: string): Promise<{}> {
    return this.provider.stat(path);
  }
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

  public get basename() {
    return pathe.basename(this._path);
  }

  public get dirname() {
    return pathe.dirname(this._path);
  }

  public join(...pieces: string[]) {
    return new Path(this._fs, pathe.join(this._path, ...pieces));
  }

  public resolve(...pieces: string[]) {
    return new Path(this._fs, pathe.resolve(this._path, ...pieces));
  }

  public toString() {
    return this._path;
  }
}
