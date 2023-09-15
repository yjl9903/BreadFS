import { inspect } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';

import { Path, BreadFSProvider } from '@breadfs/core';
import { ReadableStream, WritableStream } from 'stream/web';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export class NodeFSProvider implements BreadFSProvider {
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

  public stat(path: string): Promise<{}> {
    throw new Error('Method not implemented.');
  }

  public list(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  public walk(path: string): AsyncIterable<{}> {
    throw new Error('Method not implemented.');
  }
}

export const NodeFS = new NodeFSProvider();
