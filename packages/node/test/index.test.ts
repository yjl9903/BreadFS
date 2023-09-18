import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { BreadFS } from '@breadfs/core';

import { NodeFS } from '../src';

describe('NodeFS', () => {
  it('should construct instance', () => {
    const fs = BreadFS.of(NodeFS);
    expect(fs.provider.name).toEqual('node');
  });
});

describe('File System', () => {
  const fs = BreadFS.of(NodeFS);

  const temp = fs.path('.temp/');

  beforeAll(async () => {
    await temp.mkdir();
  });

  afterAll(async () => {
    await temp.remove();
  });

  it('should mkdir', async () => {
    const tempdir = fs.path(temp, 'nest/a/b/');
    await tempdir.mkdir();
    expect(await tempdir.exists()).toBeTruthy();

    await tempdir.remove();
    expect(await tempdir.exists()).toBeFalsy();
  });

  it('should list', async () => {
    const monorepo = fs.path('../');
    expect((await monorepo.list()).map((p) => p.toString())).toMatchInlineSnapshot(`
      [
        "../breadfs",
        "../core",
        "../node",
        "../webdav",
      ]
    `);
  });

  it('should stat', async () => {
    expect(await fs.path('src').isFile()).toBeFalsy();
    expect(await fs.path('src').isDirectory()).toBeTruthy();
    expect(await fs.path('package.json').isFile()).toBeTruthy();
    expect(await fs.path('package.json').isDirectory()).toBeFalsy();
  });

  it('should read text', async () => {
    expect(JSON.parse(await fs.path('package.json').readText()).name).toBe('@breadfs/node');
  });

  it('should write text', async () => {
    const txt = fs.path(temp, 'test.txt');
    await txt.writeText('hello');
    expect(await txt.readText()).toBe('hello');
    await txt.remove();
  });
});
