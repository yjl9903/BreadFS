import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { onDeath } from '@breadc/death';
import { BreadFS } from '@breadfs/core';

import { WebDAVProvider, AuthType } from '../src';

import { createWebDAVServer, PORT, USERNAME, PASSWORD } from './server';

describe('webdav', () => {
  let fs: BreadFS;
  let server: ReturnType<typeof createWebDAVServer> | undefined;

  beforeAll(async () => {
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
      '"{\\"test\\":true}"'
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

    expect((await fs.path('/sub1').list()).map((p) => p.path)).toMatchInlineSnapshot(`
      [
        "/sub1/irrelephant.jpg",
        "/sub1/ยากจน #1.txt",
      ]
    `);

    expect((await fs.path('/webdav/server').list()).map((p) => p.path)).toMatchInlineSnapshot(`
      [
        "/webdav/server/notreal.txt",
      ]
    `);
  });
});
