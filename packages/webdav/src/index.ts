import { BreadFSProvider } from '@breadfs/core';
import { ReadableStream, WritableStream } from 'stream/web';

export class WebDAVFSProvider extends BreadFSProvider {
  mkdir(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  createReadStream(path: string): ReadableStream<any> {
    throw new Error('Method not implemented.');
  }

  createWriteStream(path: string): WritableStream<any> {
    throw new Error('Method not implemented.');
  }

  readFile(path: string): ReadableStream<any> {
    throw new Error('Method not implemented.');
  }

  writeFile(path: string, stream: ReadableStream<any>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  remove(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  stat(path: string): Promise<{}> {
    throw new Error('Method not implemented.');
  }

  list(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  walk(path: string): AsyncIterable<{}> {
    throw new Error('Method not implemented.');
  }
}
