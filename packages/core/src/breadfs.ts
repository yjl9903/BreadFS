import pathe from 'pathe';
import { ReadableStream, WritableStream } from 'node:stream/web';

export abstract class BreadFSProvider {
  abstract mkdir(path: string): Promise<string>;

  abstract createReadStream(path: string): ReadableStream;

  abstract createWriteStream(path: string): WritableStream;

  abstract readFile(path: string): ReadableStream;

  abstract writeFile(path: string, stream: ReadableStream): Promise<void>;

  abstract remove(path: string): Promise<void>;

  abstract stat(path: string): Promise<{}>;

  abstract list(path: string): Promise<string>;

  abstract walk(path: string): AsyncIterable<{}>;
}

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

  public async mkdir(path: string): Promise<Path> {
    return this.path(await this.provider.mkdir(path));
  }

  public createReadStream(path: string): ReadableStream {
    return this.provider.createReadStream(path);
  }

  public createWriteStream(path: string): WritableStream {
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
