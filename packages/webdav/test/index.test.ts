import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { NodeFS } from '@breadfs/node';
import { onDeath } from '@breadc/death';
import { BreadFS } from '@breadfs/core';

import { WebDAVProvider, AuthType } from '../src';

import { createWebDAVServer, PORT, USERNAME, PASSWORD } from './server';

describe('webdav', () => {
  const nfs = BreadFS.of(NodeFS);
  const temp = nfs.path('.temp');

  let fs: BreadFS;
  let server: ReturnType<typeof createWebDAVServer> | undefined;

  beforeAll(async () => {
    await temp.mkdir();

    server = createWebDAVServer();
    await server.start();
    onDeath(async () => {
      server && (await server.stop());
    });

    fs = BreadFS.of(
      new WebDAVProvider(`http://127.0.0.1:${PORT}/dav`, {
        authType: AuthType.Digest,
        username: USERNAME,
        password: PASSWORD
      })
    );
  });

  afterAll(async () => {
    await temp.remove().catch(() => {});

    if (server) {
      await server.stop();
      server = undefined;
    }
  });

  it('should read file', async () => {
    expect((await fs.path('/notes.txt').readText()).trim()).toMatchInlineSnapshot(
      '"Some short notes."'
    );
    expect((await fs.path('/format.json').readText()).trim()).toMatchInlineSnapshot(
      `"{"test":true}"`
    );
  });

  it('should exists', async () => {
    expect(await fs.path('/notes.txt').exists()).toBeTruthy();
    expect(await fs.path('/nothing.txt').exists()).toBeFalsy();
  });

  it('should list files', async () => {
    expect(
      (await fs.path('/').list())
        .filter((p) => !p.path.endsWith('.DS_Store'))
        .map((p) => p.path)
        .sort()
    ).toMatchInlineSnapshot(`
      [
        "/alrighty.jpg",
        "/file % name.txt",
        "/file&name.txt",
        "/format.json",
        "/notes.txt",
        "/sub1",
        "/text document.txt",
        "/two words",
        "/two%20words",
        "/webdav",
        "/with & in path",
      ]
    `);

    expect((await fs.path('/sub1').list()).map((p) => p.path).sort()).toMatchInlineSnapshot(`
      [
        "/sub1/sub1/irrelephant.jpg",
        "/sub1/sub1/ยากจน #1.txt",
      ]
    `);

    expect((await fs.path('/webdav/server').list()).map((p) => p.path)).toMatchInlineSnapshot(`
      [
        "/webdav/server/webdav/server/notreal.txt",
      ]
    `);
  });

  it('should list files recursively', async () => {
    expect(
      (await fs.path('/').list({ recursive: true }))
        .filter((p) => !p.path.endsWith('.DS_Store'))
        .map((p) => p.path)
        .sort()
    ).toMatchInlineSnapshot(`
      [
        "/alrighty.jpg",
        "/file % name.txt",
        "/file&name.txt",
        "/format.json",
        "/notes.txt",
        "/sub1",
        "/sub1/irrelephant.jpg",
        "/sub1/ยากจน #1.txt",
        "/text document.txt",
        "/two words",
        "/two words/file.txt",
        "/two%20words",
        "/two%20words/file2.txt",
        "/webdav",
        "/webdav/server",
        "/webdav/server/notreal.txt",
        "/with & in path",
        "/with & in path/file.txt",
      ]
    `);
  });

  it('should copy file', async () => {
    const notes = fs.path('/notes.txt');
    const books = fs.path('/books.txt');
    await notes.copyTo(books);
    expect(await books.readText()).toBe(await notes.readText());
    await books.remove();
    expect(await books.exists()).toBeFalsy();
  });

  it('should move file', async () => {
    const notes = fs.path('/format.json');
    const books = fs.path('/format2.json');
    const content = await notes.readText();

    await notes.moveTo(books);
    expect(await books.readText()).toBe(content);
    await books.moveTo(notes);
  });

  it('should copy from node to webdav', async () => {
    const node = temp.join('node.txt');
    await node.writeText('This is from node');

    const to = fs.path('/webdav/node-pasted-1.txt');
    await node.copyTo(to);
    await sleep(100);
    expect(await node.exists()).toBeTruthy();
    expect(await to.readText()).toBe('This is from node');

    await node.remove();
    await to.remove();
  });

  it('should overwrite copy from node to webdav', async () => {
    const node = temp.join('node.txt');
    await node.writeText('This is from node - 1');

    const to = fs.path('/webdav/node-pasted-2.txt');
    await node.copyTo(to);
    await sleep(20);

    await node.writeText('This is from node - 2');
    await node.copyTo(to, { overwrite: true });
    await sleep(20);

    await node.writeText('This is from node - 3');
    await node.copyTo(to, { overwrite: true });
    await sleep(20);

    expect(await node.exists()).toBeTruthy();
    expect(await to.readText()).toBe('This is from node - 3');

    await node.remove();
    await to.remove();
  });

  it('should move from node to webdav', async () => {
    const node = temp.join('node-move-1.txt');
    await node.writeText('This is from node');

    const to = fs.path('/webdav/node-moved-1.txt');
    await node.moveTo(to);
    await sleep(100);
    expect(await node.exists()).toBeFalsy();
    expect(await to.readText()).toBe('This is from node');

    await node.remove();
    await to.remove();
  });

  it('should overwrite move from node to webdav', async () => {
    const node = temp.join('node-move-2.txt');
    await node.writeText('This is from node');

    const to = fs.path('/webdav/node-moved-2.txt');
    await node.copyTo(to);
    await sleep(100);
    expect(await node.exists()).toBeTruthy();
    expect(await to.readText()).toBe('This is from node');

    await node.writeText(`This is from node - 2`);
    await node.moveTo(to, { overwrite: true });
    expect(await node.exists()).toBeFalsy();
    expect(await to.readText()).toBe('This is from node - 2');

    await node.remove();
    await to.remove();
  });

  it('should copy from webdav to node', async () => {
    const notes = fs.path('/notes.txt');
    const to = temp.join('notes-pasted.txt');

    await notes.copyTo(to);
    expect(await to.readText()).toBe(await notes.readText());
    await to.remove();
  });
});

function sleep(time: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(() => res(), time);
  });
}
