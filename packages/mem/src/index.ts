import type { Zippable, ZipOptions } from 'fflate';

import pathe from 'pathe';
import { zipSync } from 'fflate';
import { Readable, Writable } from 'node:stream';

import { type IFs, Volume, createFsFromVolume } from 'memfs';

import type {
  BreadFSProvider,
  RemoveOptions,
  CopyOptions,
  MoveOptions,
  MakeDirectoryOptions,
  ListOptions,
  StatOptions,
  ReadFileOptions,
  EncodingOptions,
  WriteFileOptions,
  RawFileStat,
  ReadStreamOptions,
  WriteStreamOptions
} from '@breadfs/core';
import { wrapReadable, wrapWritable } from '@breadfs/internal';

import { ignoreNotFound } from './utils';
import { normalizeMemError } from './error';

type FsPromises = typeof import('fs/promises');

type MemFSInstance = IFs & { promises: FsPromises };

type DirectoryContent = string | Buffer | null;

interface DirectoryJSON<T extends DirectoryContent = DirectoryContent> {
  [key: string]: T;
}

// interface NestedDirectoryJSON<T extends DirectoryContent = DirectoryContent> {
//   [key: string]: T | NestedDirectoryJSON;
// }

export interface MemProviderOptions {
  /**
   * Use an existing memfs Volume. If omitted, a new one will be created.
   */
  volume?: Volume;

  /**
   * Populate the volume with initial files.
   */
  json?: DirectoryJSON<DirectoryContent>;

  /**
   * Current working directory used when applying `json`.
   */
  cwd?: string;
}

export interface MemZipOptions extends ZipOptions {
  /**
   * Include the root directory name in the ZIP output.
   * Defaults to false.
   */
  includeRoot?: boolean;
}

const toZipParts = (path: string): string[] => {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part.length > 0);
};

const ensureZipDir = (root: Zippable, path: string): Zippable => {
  const parts = toZipParts(path);
  let cursor = root;

  for (const part of parts) {
    const next = cursor[part];
    if (next instanceof Uint8Array || Array.isArray(next)) {
      throw new Error(`Can not create directory over file: ${path}`);
    }
    if (!next) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Zippable;
  }

  return cursor;
};

const setZipFile = (root: Zippable, path: string, data: Uint8Array) => {
  const parts = toZipParts(path);
  const name = parts.pop();
  if (!name) return;

  const dir = ensureZipDir(root, parts.join('/'));
  if (dir[name] && !(dir[name] instanceof Uint8Array)) {
    throw new Error(`Can not create file over directory: ${path}`);
  }
  dir[name] = data;
};

export class MemProvider implements BreadFSProvider<'mem'> {
  public readonly name = 'mem';

  public readonly volume: Volume;

  private readonly fs: MemFSInstance;

  public constructor(options: MemProviderOptions = {}) {
    if (options.volume) {
      this.volume = options.volume;
    } else {
      this.volume = Volume.fromJSON(options.json ?? {}, options.cwd);
    }

    this.fs = createFsFromVolume(this.volume) as MemFSInstance;
  }

  public static of(options: MemProviderOptions = {}) {
    return new MemProvider(options);
  }

  public createReadStream(path: string, options: ReadStreamOptions) {
    try {
      const stream = this.fs.createReadStream(path, options as any);
      return wrapReadable(Readable.toWeb(stream) as ReadableStream<Uint8Array>, (error) =>
        normalizeMemError(error, { operation: 'createReadStream', path })
      );
    } catch (error) {
      throw normalizeMemError(error, { operation: 'createReadStream', path });
    }
  }

  public createWriteStream(path: string, options: WriteStreamOptions) {
    try {
      const stream = this.fs.createWriteStream(path, options as any);

      return wrapWritable(Writable.toWeb(stream) as WritableStream<Uint8Array>, (error) =>
        normalizeMemError(error, { operation: 'createWriteStream', path })
      );
    } catch (error) {
      throw normalizeMemError(error, { operation: 'createWriteStream', path });
    }
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    try {
      await this.fs.promises.mkdir(path, options);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'mkdir', path });
    }
  }

  public mkdirSync(path: string, options: MakeDirectoryOptions): void {
    try {
      this.fs.mkdirSync(path, options as any);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'mkdirSync', path });
    }
  }

  public async readFile(path: string, _options: ReadFileOptions): Promise<Uint8Array> {
    try {
      return (await this.fs.promises.readFile(path)) as Uint8Array;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'readFile', path });
    }
  }

  public readFileSync(path: string, _options: ReadFileOptions): Uint8Array {
    try {
      return this.fs.readFileSync(path) as Uint8Array;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'readFileSync', path });
    }
  }

  public async readText(path: string, options: EncodingOptions): Promise<string> {
    try {
      const res = await this.fs.promises.readFile(path, options);
      return typeof res === 'string' ? res : res.toString(options.encoding);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'readText', path });
    }
  }

  public readTextSync(path: string, options: EncodingOptions): string {
    try {
      const res = this.fs.readFileSync(path, options);
      return typeof res === 'string' ? res : res.toString(options.encoding);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'readTextSync', path });
    }
  }

  public async writeFile(
    path: string,
    buffer: Buffer | Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    try {
      await this.fs.promises.writeFile(path, buffer, { encoding: options.encoding });
    } catch (error) {
      throw normalizeMemError(error, { operation: 'writeFile', path });
    }
  }

  public writeFileSync(path: string, buffer: Buffer | Uint8Array, options: WriteFileOptions): void {
    try {
      this.fs.writeFileSync(path, buffer, { encoding: options.encoding });
    } catch (error) {
      throw normalizeMemError(error, { operation: 'writeFileSync', path });
    }
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    try {
      await this.fs.promises.writeFile(path, content, options);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'writeText', path });
    }
  }

  public writeTextSync(path: string, content: string, options: EncodingOptions): void {
    try {
      this.fs.writeFileSync(path, content, options);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'writeTextSync', path });
    }
  }

  public copySync(src: string, dst: string, options: CopyOptions): void {
    try {
      if (typeof this.fs.cpSync !== 'function') {
        throw new Error('copySync is not supported by current memfs instance');
      }

      this.fs.cpSync(src, dst, {
        dereference: options.dereference,
        errorOnExist: options.errorOnExist,
        force: options.overwrite,
        preserveTimestamps: options.preserveTimestamps,
        recursive: true
      } as any);
    } catch (error) {
      throw normalizeMemError(error, {
        operation: 'copySync',
        path: src,
        dest: dst
      });
    }
  }

  public moveSync(src: string, dst: string, options: MoveOptions): void {
    try {
      const overwrite = options.overwrite ?? false;
      if (!overwrite && this.existsSync(dst)) {
        throw new Error(`${dst} is existed`);
      }

      if (overwrite && this.existsSync(dst)) {
        this.removeSync(dst, { recursive: true, force: true });
      }

      if (typeof this.fs.renameSync === 'function') {
        this.fs.renameSync(src, dst);
        return;
      }

      if (typeof this.fs.cpSync === 'function' && typeof this.fs.rmSync === 'function') {
        this.fs.cpSync(src, dst, {
          dereference: options.dereference,
          force: true,
          recursive: true
        } as any);
        this.fs.rmSync(src, { recursive: true, force: true } as any);
        return;
      }

      throw new Error('moveSync is not supported by current memfs instance');
    } catch (error) {
      throw normalizeMemError(error, {
        operation: 'moveSync',
        path: src,
        dest: dst
      });
    }
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    try {
      const resolved = { force: true, recursive: true, ...options };
      if (typeof this.fs.promises.rm === 'function') {
        await this.fs.promises.rm(path, resolved as any);
        return;
      }

      const stat = await this.fs.promises.stat(path).catch((error) => {
        if ((error as any).code === 'ENOENT') {
          if (resolved.force) {
            return null;
          }
        }
        throw error;
      });
      if (!stat) return;

      if (stat.isDirectory()) {
        if (resolved.recursive) {
          const entries = await this.fs.promises.readdir(path);
          for (const entry of entries) {
            await this.remove(pathe.join(path, String(entry)), options);
          }
        }
        await this.fs.promises.rmdir(path);
      } else {
        await this.fs.promises.unlink(path);
      }
    } catch (error) {
      throw normalizeMemError(error, { operation: 'remove', path });
    }
  }

  public removeSync(path: string, options: RemoveOptions): void {
    try {
      const resolved = { force: true, recursive: true, ...options };
      if (typeof this.fs.rmSync === 'function') {
        this.fs.rmSync(path, resolved as any);
        return;
      }

      const stat = (() => {
        try {
          return this.fs.statSync(path);
        } catch (error) {
          if ((error as any).code === 'ENOENT') {
            if (resolved.force) {
              return null;
            }
          }
          throw error;
        }
      })();
      if (!stat) return;

      if (stat.isDirectory()) {
        if (resolved.recursive) {
          const entries = this.fs.readdirSync(path);
          for (const entry of entries) {
            this.removeSync(pathe.join(path, String(entry)), options);
          }
        }
        this.fs.rmdirSync(path);
      } else {
        this.fs.unlinkSync(path);
      }
    } catch (error) {
      throw normalizeMemError(error, { operation: 'removeSync', path });
    }
  }

  public async stat(path: string, options: StatOptions): Promise<RawFileStat> {
    try {
      const stat = await this.fs.promises.stat(path, options as any);

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
      throw normalizeMemError(error, { operation: 'stat', path });
    }
  }

  public statSync(path: string, options: StatOptions): RawFileStat {
    try {
      const stat = this.fs.statSync(path, options as any);

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
      throw normalizeMemError(error, { operation: 'statSync', path });
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await this.fs.promises.access(path);
      return true;
    } catch (error) {
      ignoreNotFound(normalizeMemError(error, { operation: 'exists', path }));
      return false;
    }
  }

  public existsSync(path: string): boolean {
    try {
      this.fs.accessSync(path);
      return true;
    } catch (error) {
      ignoreNotFound(
        normalizeMemError(error, { operation: 'existsSync', path })
      );
      return false;
    }
  }

  public async list(path: string, options: ListOptions = {}): Promise<string[]> {
    try {
      const recursive = options.recursive ?? false;
      const entries = await this.fs.promises.readdir(path);
      const results: string[] = [];

      for (const entry of entries) {
        const full = pathe.join(path, String(entry));
        results.push(full);

        if (recursive) {
          const stat = await this.stat(full, {});
          if (stat.isDirectory()) {
            results.push(...(await this.list(full, options)));
          }
        }
      }

      return results;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'list', path });
    }
  }

  public listSync(path: string, options: ListOptions = {}): string[] {
    try {
      const recursive = options.recursive ?? false;
      const entries = this.fs.readdirSync(path);
      const results: string[] = [];

      for (const entry of entries) {
        const full = pathe.join(path, String(entry));
        results.push(full);

        if (recursive) {
          const stat = this.statSync(full, {});
          if (stat.isDirectory()) {
            results.push(...this.listSync(full, options));
          }
        }
      }

      return results;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'listSync', path });
    }
  }

  public async listStat(path: string, options: ListOptions = {}): Promise<RawFileStat[]> {
    try {
      const recursive = options.recursive ?? false;
      const entries = await this.fs.promises.readdir(path);
      const results: RawFileStat[] = [];

      for (const entry of entries) {
        const full = pathe.join(path, String(entry));
        const stat = await this.stat(full, {});
        results.push(stat);

        if (recursive && stat.isDirectory()) {
          results.push(...(await this.listStat(full, options)));
        }
      }

      return results;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'listStat', path });
    }
  }

  public listStatSync(path: string, options: ListOptions = {}): RawFileStat[] {
    try {
      const recursive = options.recursive ?? false;
      const entries = this.fs.readdirSync(path);
      const results: RawFileStat[] = [];

      for (const entry of entries) {
        const full = pathe.join(path, String(entry));
        const stat = this.statSync(full, {});
        results.push(stat);

        if (recursive && stat.isDirectory()) {
          results.push(...this.listStatSync(full, options));
        }
      }

      return results;
    } catch (error) {
      throw normalizeMemError(error, { operation: 'listStatSync', path });
    }
  }

  public async zip(path: string = '/', options: MemZipOptions = {}): Promise<Uint8Array> {
    try {
      const { includeRoot = false, ...zipOptions } = options;
      const rootPath = pathe.normalize(path);
      const rootStat = await this.stat(rootPath, {});

      const zippable: Zippable = {};

      if (rootStat.isFile()) {
        const name = pathe.basename(rootPath);
        if (!name) {
          throw new Error('Can not zip unnamed root file');
        }
        zippable[name] = await this.readFile(rootPath, {});
        return zipSync(zippable, zipOptions);
      }

      const rootName = includeRoot && pathe.basename(rootPath) ? pathe.basename(rootPath) : '';
      const base = rootName ? ensureZipDir(zippable, rootName) : zippable;

      const entries = await this.listStat(rootPath, { recursive: true });
      for (const entry of entries) {
        const relative = pathe.relative(rootPath, entry.path);
        if (!relative || relative === '.') continue;

        if (entry.isDirectory()) {
          ensureZipDir(base, relative);
          continue;
        }

        if (entry.isFile()) {
          const data = await this.readFile(entry.path, {});
          setZipFile(base, relative, data);
        }
      }

      return zipSync(zippable, zipOptions);
    } catch (error) {
      throw normalizeMemError(error, { operation: 'zip', path });
    }
  }
}

export type { MemErrorSource } from './error';
