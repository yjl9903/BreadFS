import type { DirectoryJSON, DirectoryContent } from 'memfs/lib/core';

import pathe from 'pathe';
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
}
