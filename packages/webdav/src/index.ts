import { Readable, Writable } from 'node:stream';
import {
  createClient,
  WebDAVClient,
  WebDAVClientOptions,
  FileStat as WebDAVFileStat
} from 'webdav';

import { BreadFSProvider, FileStat, MakeDirectoryOptions } from '@breadfs/core';

export { AuthType, Headers, OAuthToken } from 'webdav';

export class WebDAVProvider implements BreadFSProvider {
  public readonly name = 'webdav';

  private readonly client: WebDAVClient;

  public constructor(remoteURL: string, options: WebDAVClientOptions = {}) {
    this.client = createClient(remoteURL, options);
  }

  public static of(remoteURL: string, options: WebDAVClientOptions = {}) {
    return new WebDAVProvider(remoteURL, options);
  }

  public createReadStream(path: string) {
    const stream = this.client.createReadStream(path);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array> & {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
    };
  }

  public createWriteStream(path: string) {
    const stream = this.client.createWriteStream(path);
    return Writable.toWeb(stream) as WritableStream;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await this.client.createDirectory(path, options);
  }

  public async readFile(path: string): Promise<Buffer> {
    throw new Error('Method not implemented.');
  }

  public async writeFile(path: string, stream: ReadableStream<any>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async remove(path: string): Promise<void> {
    await this.client.deleteFile(path);
  }

  public async stat(path: string): Promise<FileStat> {
    const stat = (await this.client.stat(path)) as WebDAVFileStat;

    return {
      size: stat.size,
      isFile: stat.type === 'file',
      isDirectory: stat.type === 'directory',
      mtime: new Date(stat.lastmod),
      birthtime: undefined
    };
  }

  public async exists(path: string): Promise<boolean> {
    return await this.client.exists(path);
  }

  public async list(path: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
