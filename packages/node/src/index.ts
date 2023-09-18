import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream, StatOptions } from 'node:fs';

import {
  Path,
  BreadFSProvider,
  FileStat,
  RmOptions,
  MakeDirectoryOptions,
  ListOptions
} from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeProvider implements BreadFSProvider {
  public readonly name = 'node';

  public createReadStream(path: string): ReadableStream<any> {
    const stream = createReadStream(path);
    return Readable.toWeb(stream) as ReadableStream;
  }

  public createWriteStream(path: string): WritableStream<any> {
    const stream = createWriteStream(path);
    return Writable.toWeb(stream) as WritableStream;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await fs.mkdir(path, options);
  }

  public async readFile(path: string): Promise<Buffer> {
    return await fs.readFile(path);
  }

  public async readText(path: string): Promise<string> {
    return await fs.readFile(path, 'utf-8');
  }

  public async writeFile(path: string, stream: ReadableStream<any>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async writeText(path: string, content: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async remove(path: string, options: RmOptions): Promise<void> {
    await fs.rm(path, options);
  }

  public async stat(path: string, options: StatOptions): Promise<FileStat> {
    const stat = await fs.stat(path, options);

    return {
      size: stat.size,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
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
