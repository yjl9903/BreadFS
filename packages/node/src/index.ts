import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';

import pathe from 'pathe';
import fse from 'fs-extra';

import {
  Path,
  BreadFSProvider,
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
  WriteFileOptions,
  RawFileStat
} from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeProvider implements BreadFSProvider<'node'> {
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
    return await fs.readFile(path, {});
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
    stream: Buffer | Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    await fs.writeFile(path, stream, { encoding: options.encoding });
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    await fs.writeFile(path, content, options);
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    await fse.rm(path, options);
  }

  public async copy(src: string, dst: string, options: CopyOptions): Promise<void> {
    await fse.copy(src, dst, options);
  }

  public async move(src: string, dst: string, options: MoveOptions): Promise<void> {
    await fse.move(src, dst, options);
  }

  public async stat(path: string, options: StatOptions): Promise<RawFileStat> {
    const stat = await fs.stat(path, options);

    return {
      path,
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
    return (await fs.readdir(path, options)).map((p) => pathe.join(path, p));
  }

  public async listStat(path: string, options: ListOptions): Promise<RawFileStat[]> {
    const dirs = await fs.readdir(path, { ...options, withFileTypes: true });

    return dirs.map((stat) => ({
      path: pathe.join(stat.path, stat.name),
      size: undefined,
      isFile: () => stat.isFile(),
      isDirectory: () => stat.isDirectory(),
      isSymbolicLink: () => stat.isSymbolicLink(),
      mtime: undefined,
      birthtime: undefined
    }));
  }
}

export const NodeFS = new NodeProvider();
