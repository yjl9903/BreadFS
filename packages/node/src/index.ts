import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream, StatOptions } from 'node:fs';

import {
  Path,
  BreadFSProvider,
  FileStat,
  RmOptions,
  MakeDirectoryOptions,
  ListOptions,
  ReadFileOptions,
  EncodingOptions
} from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeProvider implements BreadFSProvider {
  public readonly name = 'node';

  public createReadStream(path: string) {
    const stream = createReadStream(path);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  public createWriteStream(path: string) {
    const stream = createWriteStream(path);
    return Writable.toWeb(stream) as WritableStream<Uint8Array>;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await fs.mkdir(path, options);
  }

  public async readFile(path: string, options: ReadFileOptions): Promise<Buffer> {
    return await fs.readFile(path, options);
  }

  public async readText(path: string, options: EncodingOptions): Promise<string> {
    const res = await fs.readFile(path, options);
    if (typeof res === 'string') {
      return res;
    } else {
      return res.toString();
    }
  }

  public async writeFile(
    path: string,
    stream: ReadableStream<Uint8Array>,
    options: EncodingOptions
  ): Promise<void> {
    await fs.writeFile(path, stream, options);
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    await fs.writeFile(path, content, options);
  }

  public async remove(path: string, options: RmOptions): Promise<void> {
    await fs.rm(path, options);
  }

  public async stat(path: string, options: StatOptions): Promise<FileStat> {
    const stat = await fs.stat(path, options);

    return {
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      mtime: stat.mtime,
      birthtime: stat.birthtime
    };
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  public async list(path: string, options: ListOptions): Promise<string[]> {
    return await fs.readdir(path, options);
  }
}

export const NodeFS = new NodeProvider();
