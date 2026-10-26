import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import {
  promises as fs,
  createReadStream,
  createWriteStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync,
  accessSync
} from 'node:fs';

import pathe from 'pathe';
import fse from 'fs-extra';

import type {
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
import { wrapReadable, wrapWritable } from '@breadfs/internal';

import { Path } from '@breadfs/core';

import { ignoreNotFound } from './utils';
import { normalizeNodeError } from './error';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return `"${this.fs.provider.name}://${this.toString()}"`;
};

export class NodeProvider implements BreadFSProvider<'node'> {
  public readonly name = 'node';

  public createReadStream(path: string, options: ReadStreamOptions) {
    try {
      const stream = createReadStream(path, options);
      return wrapReadable(Readable.toWeb(stream) as ReadableStream<Uint8Array>, (error) =>
        normalizeNodeError(error, { operation: 'createReadStream', path })
      );
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'createReadStream', path });
    }
  }

  public createWriteStream(path: string, options: WriteStreamOptions) {
    try {
      const stream = createWriteStream(path, options);
      return wrapWritable(Writable.toWeb(stream) as WritableStream<Uint8Array>, (error) =>
        normalizeNodeError(error, { operation: 'createWriteStream', path })
      );
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'createWriteStream', path });
    }
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    try {
      await fs.mkdir(path, options);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'mkdir', path });
    }
  }

  public mkdirSync(path: string, options: MakeDirectoryOptions): void {
    try {
      mkdirSync(path, options);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'mkdirSync', path });
    }
  }

  public async readFile(path: string, options: ReadFileOptions): Promise<Uint8Array> {
    try {
      return await fs.readFile(path, {});
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'readFile', path });
    }
  }

  public readFileSync(path: string, _options: ReadFileOptions): Uint8Array {
    try {
      return readFileSync(path) as Uint8Array;
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'readFileSync', path });
    }
  }

  public async readText(path: string, options: EncodingOptions): Promise<string> {
    try {
      const res = await fs.readFile(path, options);
      if (typeof res === 'string') {
        return res;
      } else {
        return res.toString();
      }
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'readText', path });
    }
  }

  public readTextSync(path: string, options: EncodingOptions): string {
    try {
      const res = readFileSync(path, options);
      return typeof res === 'string' ? res : res.toString();
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'readTextSync', path });
    }
  }

  public async writeFile(
    path: string,
    stream: Buffer | Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    try {
      await fs.writeFile(path, stream, { encoding: options.encoding });
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'writeFile', path });
    }
  }

  public writeFileSync(path: string, stream: Buffer | Uint8Array, options: WriteFileOptions): void {
    try {
      writeFileSync(path, stream, { encoding: options.encoding });
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'writeFileSync', path });
    }
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    try {
      await fs.writeFile(path, content, options);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'writeText', path });
    }
  }

  public writeTextSync(path: string, content: string, options: EncodingOptions): void {
    try {
      writeFileSync(path, content, options);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'writeTextSync', path });
    }
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    try {
      await fse.rm(path, options);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'remove', path });
    }
  }

  public removeSync(path: string, options: RemoveOptions): void {
    try {
      fse.rmSync(path, options as any);
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'removeSync', path });
    }
  }

  public async copy(src: string, dst: string, options: CopyOptions): Promise<void> {
    try {
      await fse.copy(src, dst, options);
    } catch (error) {
      throw normalizeNodeError(error, {
        operation: 'copy',
        path: src,
        dest: dst
      });
    }
  }

  public copySync(src: string, dst: string, options: CopyOptions): void {
    try {
      fse.copySync(src, dst, options as any);
    } catch (error) {
      throw normalizeNodeError(error, {
        operation: 'copySync',
        path: src,
        dest: dst
      });
    }
  }

  public async move(src: string, dst: string, options: MoveOptions): Promise<void> {
    try {
      await fse.move(src, dst, options);
    } catch (error) {
      throw normalizeNodeError(error, {
        operation: 'move',
        path: src,
        dest: dst
      });
    }
  }

  public moveSync(src: string, dst: string, options: MoveOptions): void {
    try {
      fse.moveSync(src, dst, options as any);
    } catch (error) {
      throw normalizeNodeError(error, {
        operation: 'moveSync',
        path: src,
        dest: dst
      });
    }
  }

  public async stat(path: string, options: StatOptions): Promise<RawFileStat> {
    try {
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
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'stat', path });
    }
  }

  public statSync(path: string, options: StatOptions): RawFileStat {
    try {
      const stat = statSync(path, options as any);

      return {
        path,
        size: stat.size,
        isFile: () => stat.isFile(),
        isDirectory: () => stat.isDirectory(),
        isSymbolicLink: () => stat.isSymbolicLink(),
        mtime: stat.mtime,
        birthtime: stat.birthtime
      };
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'statSync', path });
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      ignoreNotFound(normalizeNodeError(error, { operation: 'exists', path }));
      return false;
    }
  }

  public existsSync(path: string): boolean {
    try {
      accessSync(path);
      return true;
    } catch (error) {
      ignoreNotFound(
        normalizeNodeError(error, { operation: 'existsSync', path })
      );
      return false;
    }
  }

  public async list(path: string, options: ListOptions): Promise<string[]> {
    try {
      return (await fs.readdir(path, options)).map((p) => pathe.join(path, p));
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'list', path });
    }
  }

  public listSync(path: string, options: ListOptions): string[] {
    try {
      return readdirSync(path, options).map((p) => pathe.join(path, String(p)));
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'listSync', path });
    }
  }

  public async listStat(path: string, options: ListOptions): Promise<RawFileStat[]> {
    try {
      const dirs = await fs.readdir(path, { ...options, withFileTypes: true });

      return dirs.map((stat) => ({
        path: pathe.join(stat.parentPath, stat.name),
        size: undefined,
        isFile: () => stat.isFile(),
        isDirectory: () => stat.isDirectory(),
        isSymbolicLink: () => stat.isSymbolicLink(),
        mtime: undefined,
        birthtime: undefined
      }));
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'listStat', path });
    }
  }

  public listStatSync(path: string, options: ListOptions): RawFileStat[] {
    try {
      const dirs = readdirSync(path, { ...options, withFileTypes: true });

      return dirs.map((stat) => {
        const parent = (stat as any).parentPath ?? (stat as any).path ?? path;
        return {
          path: pathe.join(parent, stat.name),
          size: undefined,
          isFile: () => stat.isFile(),
          isDirectory: () => stat.isDirectory(),
          isSymbolicLink: () => stat.isSymbolicLink(),
          mtime: undefined,
          birthtime: undefined
        };
      });
    } catch (error) {
      throw normalizeNodeError(error, { operation: 'listStatSync', path });
    }
  }
}

export const NodeFS = new NodeProvider();

export type { NodeErrorSource } from './error';
