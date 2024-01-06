import type { WebDAVClientOptions, FileStat as WebDAVFileStat } from 'webdav';

import { Readable, Writable } from 'node:stream';
import { createClient, WebDAVClient } from 'webdav';

import type {
  BreadFSProvider,
  CopyOptions,
  MoveOptions,
  RemoveOptions,
  ListOptions,
  MakeDirectoryOptions,
  ReadFileOptions,
  WriteFileOptions,
  RawFileStat
} from '@breadfs/core';

export type { Headers, OAuthToken, WebDAVClient, WebDAVClientOptions } from 'webdav';

export class WebDAVProvider implements BreadFSProvider<'webdav'> {
  public readonly name = 'webdav';

  public readonly url: string;

  public readonly options: WebDAVClientOptions;

  public readonly client: WebDAVClient;

  public constructor(remoteURL: string, options: WebDAVClientOptions = {}) {
    this.url = remoteURL;
    this.options = options;
    this.client = createClient(remoteURL, options);
  }

  public static of(remoteURL: string, options: WebDAVClientOptions = {}) {
    return new WebDAVProvider(remoteURL, options);
  }

  public createReadStream(path: string) {
    const stream = this.client.createReadStream(path);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  public createWriteStream(path: string) {
    const stream = this.client.createWriteStream(path, { overwrite: true });
    return Writable.toWeb(stream) as WritableStream;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await this.client.createDirectory(path, options);
  }

  public async readFile(path: string, options: ReadFileOptions): Promise<Uint8Array> {
    const content = (await this.client.getFileContents(path, {
      format: 'binary',
      onDownloadProgress: options.onProgress
        ? (ev) => {
            options.onProgress?.({ current: ev.loaded, total: ev.total });
          }
        : undefined
    })) as Uint8Array;
    return content;
  }

  public async writeFile(
    path: string,
    buffer: Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    await this.client.putFileContents(path, buffer, {
      overwrite: true,
      onUploadProgress: options.onProgress
        ? (ev) => {
            options.onProgress?.({ current: ev.loaded, total: ev.total });
          }
        : undefined
    });
  }

  public async copy(src: string, dst: string, options: CopyOptions) {
    await this.client.copyFile(src, dst);
  }

  public async move(src: string, dst: string, options: MoveOptions) {
    await this.client.moveFile(src, dst);
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    const force = options.force ?? true;
    try {
      await this.client.deleteFile(path);
    } catch (_error) {
      const error = _error as any;
      if (error.status === 404 && error.response) {
        if (!force) {
          throw error;
        }
      }
    }
  }

  public async stat(path: string): Promise<RawFileStat> {
    const stat = (await this.client.stat(path)) as WebDAVFileStat;

    return {
      path,
      size: stat.size,
      isFile: () => stat.type === 'file',
      isDirectory: () => stat.type === 'directory',
      isSymbolicLink: () => false,
      mtime: new Date(stat.lastmod),
      birthtime: undefined
    };
  }

  public async exists(path: string): Promise<boolean> {
    return await this.client.exists(path);
  }

  public async list(path: string, options: ListOptions): Promise<string[]> {
    const ps = (await this.client.getDirectoryContents(path, {
      deep: options.recursive
    })) as WebDAVFileStat[];
    return ps.map((p) => p.filename);
  }

  public async listStat(path: string, options: ListOptions): Promise<RawFileStat[]> {
    const ps = (await this.client.getDirectoryContents(path, {
      deep: options.recursive
    })) as WebDAVFileStat[];

    return ps.map((stat) => ({
      path: stat.filename,
      size: stat.size,
      isFile: () => stat.type === 'file',
      isDirectory: () => stat.type === 'directory',
      isSymbolicLink: () => false,
      mtime: new Date(stat.lastmod),
      birthtime: undefined
    }));
  }
}
