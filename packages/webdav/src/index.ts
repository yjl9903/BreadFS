import type { ReadableStream, WritableStream } from 'node:stream/web';

import { BreadFSProvider, FileStat } from '@breadfs/core';

export class WebDAVFSProvider implements BreadFSProvider {
  public mkdir(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public createReadStream(path: string): ReadableStream<any> {
    throw new Error('Method not implemented.');
  }

  public createWriteStream(path: string): WritableStream<any> {
    throw new Error('Method not implemented.');
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

  public exists(path: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  public list(path: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
