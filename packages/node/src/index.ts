import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';

import { copy, move } from 'fs-extra';

import {
  Path,
  BreadFSProvider,
  FileStat,
  RemoveOptions,
  MakeDirectoryOptions,
  ListOptions,
  StatOptions,
  ReadFileOptions,
  EncodingOptions,
  CopyOptions,
  MoveOptions,
  ReadStreamOptions,
  WriteStreamOptions,
  WriteFileOptions
} from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeProvider implements BreadFSProvider {
  public readonly name = 'node';

  public createReadStream(path: string, options: ReadStreamOptions) {
    const stream = createReadStream(path, options);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  public createWriteStream(path: string, options: WriteStreamOptions) {
    const stream = createWriteStream(path, options);
    return Writable.toWeb(stream) as WritableStream<Uint8Array>;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await fs.mkdir(path, options);
  }

  public async readFile(path: string, options: ReadFileOptions): Promise<Uint8Array> {
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
    stream: Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    await fs.writeFile(path, stream, options);
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    await fs.writeFile(path, content, options);
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    await fs.rm(path, options);
  }

  public async copy(src: string, dst: string, options: CopyOptions): Promise<void> {
    await copy(src, dst, options);
  }

  public async move(src: string, dst: string, options: MoveOptions): Promise<void> {
    await move(src, dst, options);
  }

  public async stat(path: string, options: StatOptions): Promise<FileStat> {
    const stat = await fs.stat(path, options);

    return {
      size: stat.size,
      isFile: () => stat.isFile(),
      isDirectory: () => stat.isDirectory(),
      isSymbolicLink: () => stat.isSymbolicLink(),
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
