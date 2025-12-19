import type { Zippable, ZipOptions } from 'fflate';
import type { DirectoryJSON, DirectoryContent } from 'memfs/lib/core';

import pathe from 'pathe';
import { zipSync } from 'fflate';
import { Readable, Writable } from 'node:stream';

import { type IFs, Volume, createFsFromVolume } from 'memfs';

import type {
  BreadFSProvider,
  RemoveOptions,
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

type FsPromises = typeof import('fs/promises');

type MemFSInstance = IFs & { promises: FsPromises };

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

  private readonly promises: FsPromises;

  public constructor(options: MemProviderOptions = {}) {
    if (options.volume) {
      this.volume = options.volume;
    } else {
      this.volume = Volume.fromJSON(options.json ?? {}, options.cwd);
    }

    this.fs = createFsFromVolume(this.volume) as MemFSInstance;
    this.promises = this.fs.promises;
  }

  public static of(options: MemProviderOptions = {}) {
    return new MemProvider(options);
  }

  public createReadStream(path: string, options: ReadStreamOptions) {
    const stream = this.fs.createReadStream(path, options as any);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  public createWriteStream(path: string, options: WriteStreamOptions) {
    const stream = this.fs.createWriteStream(path, options as any);
    return Writable.toWeb(stream) as WritableStream<Uint8Array>;
  }

  public async mkdir(path: string, options: MakeDirectoryOptions): Promise<void> {
    await this.promises.mkdir(path, options);
  }

  public async readFile(path: string, _options: ReadFileOptions): Promise<Uint8Array> {
    return (await this.promises.readFile(path)) as Uint8Array;
  }

  public async readText(path: string, options: EncodingOptions): Promise<string> {
    const res = await this.promises.readFile(path, options);
    return typeof res === 'string' ? res : res.toString(options.encoding);
  }

  public async writeFile(
    path: string,
    buffer: Buffer | Uint8Array,
    options: WriteFileOptions
  ): Promise<void> {
    await this.promises.writeFile(path, buffer, { encoding: options.encoding });
  }

  public async writeText(path: string, content: string, options: EncodingOptions): Promise<void> {
    await this.promises.writeFile(path, content, options);
  }

  public async remove(path: string, options: RemoveOptions): Promise<void> {
    const resolved = { force: true, recursive: true, ...options };
    if (typeof this.promises.rm === 'function') {
      await this.promises.rm(path, resolved as any);
      return;
    }

    const stat = await this.promises.stat(path).catch((error) => {
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
        const entries = await this.promises.readdir(path);
        for (const entry of entries) {
          await this.remove(pathe.join(path, entry), options);
        }
      }
      await this.promises.rmdir(path);
    } else {
      await this.promises.unlink(path);
    }
  }

  public async stat(path: string, options: StatOptions): Promise<RawFileStat> {
    const stat = await this.promises.stat(path, options as any);

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
      await this.promises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  public async list(path: string, options: ListOptions = {}): Promise<string[]> {
    const recursive = options.recursive ?? false;
    const entries = await this.promises.readdir(path);
    const results: string[] = [];

    for (const entry of entries) {
      const full = pathe.join(path, entry);
      results.push(full);

      if (recursive) {
        const stat = await this.stat(full, {});
        if (stat.isDirectory()) {
          results.push(...(await this.list(full, options)));
        }
      }
    }

    return results;
  }

  public async listStat(path: string, options: ListOptions = {}): Promise<RawFileStat[]> {
    const recursive = options.recursive ?? false;
    const entries = await this.promises.readdir(path);
    const results: RawFileStat[] = [];

    for (const entry of entries) {
      const full = pathe.join(path, entry);
      const stat = await this.stat(full, {});
      results.push(stat);

      if (recursive && stat.isDirectory()) {
        results.push(...(await this.listStat(full, options)));
      }
    }

    return results;
  }

  public async zip(path: string = '/', options: MemZipOptions = {}): Promise<Uint8Array> {
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
  }
}
