import type { ReadableStream, WritableStream } from 'node:stream/web';

import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';

import { Path, BreadFSProvider, FileStat } from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeProvider implements BreadFSProvider {
  public readonly name = 'node';

  public async mkdir(path: string): Promise<void> {
    await fs.mkdir(path);
  }

  public createReadStream(path: string): ReadableStream<any> {
    const stream = createReadStream(path);
    return Readable.toWeb(stream);
  }

  public createWriteStream(path: string): WritableStream<any> {
    const stream = createWriteStream(path);
    return Writable.toWeb(stream);
  }

  public readFile(path: string): ReadableStream<any> {
    throw new Error('Method not implemented.');
  }

  public writeFile(path: string, stream: ReadableStream<any>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public remove(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public stat(path: string): Promise<FileStat> {
    throw new Error('Method not implemented.');
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  public list(path: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}

export const NodeFS = new NodeProvider();
