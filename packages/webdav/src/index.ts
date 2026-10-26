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
  RawFileStat,
  WriteStreamOptions
} from '@breadfs/core';
import { wrapReadable, wrapWritable } from '@breadfs/internal';

import { BreadFSError } from '@breadfs/core';

import { normalizeWebDAVError, webDAVStatus } from './error';

export type { Headers, OAuthToken, WebDAVClient, WebDAVClientOptions } from 'webdav';

export { AuthType } from 'webdav';

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
    try {
      const stream = this.client.createReadStream(path);

      // WebDAV declares platform-neutral streams; Node's adapter requires a Readable.
      if (!(stream instanceof Readable)) {
        throw new TypeError('Expected a Node.js readable stream from WebDAV');
      }

      return wrapReadable(Readable.toWeb(stream) as ReadableStream<Uint8Array>, (error) =>
        normalizeWebDAVError(error, { operation: 'createReadStream', path })
      );
    } catch (error) {
      throw normalizeWebDAVError(error, {
        operation: 'createReadStream',
        path
      });
    }
  }

  public createWriteStream(path: string, options: WriteStreamOptions) {
    try {
      const headers: Record<string, string> = {};
      if (options.contentLength !== undefined) {
        headers['Content-Length'] = `${options.contentLength}`;
      }

      let complete!: () => void;
      let fail!: (error: unknown) => void;
      const completed = new Promise<void>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const stream = this.client.createWriteStream(
        path,
        {
          overwrite: true,
          headers
        },
        complete
      );

      if (!(stream instanceof Writable)) {
        throw new TypeError('Expected a Node.js writable stream from WebDAV');
      }

      stream.once('error', fail);
      const writer = (Writable.toWeb(stream) as WritableStream<Uint8Array>).getWriter();
      return wrapWritable(
        new WritableStream<Uint8Array>({
          start(controller) {
            void completed.catch((error) => controller.error(error));
            void writer.closed.catch((error) => controller.error(error));
          },
          write: (chunk) => writer.write(chunk),
          async close() {
            try {
              await writer.close();
              // The Node stream finishes before the server acknowledges the PUT.
              await completed;
            } finally {
              writer.releaseLock();
            }
          },
          async abort(reason) {
            try {
              await writer.abort(reason);
            } finally {
              writer.releaseLock();
            }
          }
        }),
        (error) =>
          normalizeWebDAVError(error, { operation: 'createWriteStream', path })
      );
    } catch (error) {
      throw normalizeWebDAVError(error, {
        operation: 'createWriteStream',
        path
      });
    }
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    try {
      await this.client.createDirectory(path, options);
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'mkdir', path });
    }
  }

  public async readFile(path: string, options: ReadFileOptions): Promise<Uint8Array> {
    try {
      const content = (await this.client.getFileContents(path, {
        format: 'binary',
        onDownloadProgress: options.onProgress
          ? (ev) => {
              options.onProgress?.({ current: ev.loaded, total: ev.total });
            }
          : undefined
      })) as Uint8Array;
      return content;
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'readFile', path });
    }
  }

  public async writeFile(
    path: string,
    buffer: Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    try {
      await this.client.putFileContents(path, buffer as Buffer, {
        overwrite: true,
        onUploadProgress: options.onProgress
          ? (ev) => {
              options.onProgress?.({ current: ev.loaded, total: ev.total });
            }
          : undefined
      });
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'writeFile', path });
    }
  }

  public async copy(src: string, dst: string, options: CopyOptions) {
    try {
      await this.client.copyFile(src, dst, { overwrite: options.overwrite });
    } catch (error) {
      if (webDAVStatus(error) === 412 && options.overwrite === false) {
        if (!options.errorOnExist) return;
        throw new BreadFSError(error, {
          code: 'EEXIST',
          operation: 'copy',
          path: src,
          dest: dst,
          source: { provider: 'webdav', status: 412 }
        });
      }
      throw normalizeWebDAVError(error, {
        operation: 'copy',
        path: src,
        dest: dst
      });
    }
  }

  public async move(src: string, dst: string, options: MoveOptions) {
    const overwrite = options.overwrite ?? false;
    try {
      await this.client.moveFile(src, dst, { overwrite });
    } catch (error) {
      if (webDAVStatus(error) === 412 && !overwrite) {
        throw new BreadFSError(error, {
          code: 'EEXIST',
          operation: 'move',
          path: src,
          dest: dst,
          source: { provider: 'webdav', status: 412 }
        });
      }
      throw normalizeWebDAVError(error, {
        operation: 'move',
        path: src,
        dest: dst
      });
    }
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    const force = options.force ?? true;
    try {
      await this.client.deleteFile(path);
    } catch (error) {
      if (force && webDAVStatus(error) === 404) return;
      throw normalizeWebDAVError(error, { operation: 'remove', path });
    }
  }

  public async stat(path: string): Promise<RawFileStat> {
    try {
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
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'stat', path });
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      return await this.client.exists(path);
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'exists', path });
    }
  }

  public async list(path: string, options: ListOptions): Promise<string[]> {
    try {
      const ps = (await this.client.getDirectoryContents(path, {
        deep: options.recursive
      })) as WebDAVFileStat[];
      return ps.map((p) => p.filename);
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'list', path });
    }
  }

  public async listStat(path: string, options: ListOptions): Promise<RawFileStat[]> {
    try {
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
    } catch (error) {
      throw normalizeWebDAVError(error, { operation: 'listStat', path });
    }
  }
}

export type { WebDAVErrorSource } from './error';
