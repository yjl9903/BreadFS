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

  it('should work', async () => {
    expect(await fs.path('/nothing.txt').exists()).toBeFalsy();
  });
});
