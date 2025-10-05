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
    expect(
      (await monorepo.list())
        .map((p) => p.toString())
        .filter((p) => !p.endsWith('.DS_Store'))
        .sort()
    ).toMatchInlineSnapshot(`
      [
        "../breadfs",
        "../core",
        "../node",
        "../webdav",
      ]
    `);
  });

  it('should list stat', async () => {
    const monorepo = fs.path('../');
    expect(
      (await monorepo.listStat())
        .map((p) => p.path.toString())
        .filter((p) => !p.endsWith('.DS_Store'))
        .sort()
    ).toMatchInlineSnapshot(`
      [
        "../breadfs",
        "../core",
        "../node",
        "../webdav",
      ]
    `);
  });

  it('should list recursive', async () => {
    const core = fs.path('../core/src');
    expect((await core.list({ recursive: true })).map((p) => p.toString()).sort())
      .toMatchInlineSnapshot(`
        [
          "../core/src/breadfs.ts",
          "../core/src/error.ts",
          "../core/src/index.ts",
          "../core/src/provider",
          "../core/src/provider/index.ts",
          "../core/src/provider/types.ts",
          "../core/src/shim.d.ts",
        ]
      `);
  });

  it('should list stat recursive', async () => {
    const core = fs.path('../core/src');
    expect((await core.listStat({ recursive: true })).map((p) => p.path.toString()).sort())
      .toMatchInlineSnapshot(`
        [
          "../core/src/breadfs.ts",
          "../core/src/error.ts",
          "../core/src/index.ts",
          "../core/src/provider",
          "../core/src/provider/index.ts",
          "../core/src/provider/types.ts",
          "../core/src/shim.d.ts",
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

  it('should copy', async () => {
    const from = fs.path(temp, 'copied.txt');
    const to = fs.path(temp, 'pasted.txt');

    await from.writeText('hello');
    await from.copyTo(to);

    expect(await to.readText()).toBe('hello');

    await from.remove();
    await to.remove();
  });

  it('should copy directory', async () => {
    const dir1 = fs.path(temp, 'dir1');
    const dir2 = fs.path(temp, 'dir2');

    const from1 = fs.path(dir1, 'file1.txt');
    const from2 = fs.path(dir1, 'file2.txt');
    const from3 = fs.path(dir1, 'nest', 'file.txt');

    await fs.path(dir1).mkdir();
    await fs.path(dir1, 'nest').mkdir();
    await from1.writeText('hello1');
    await from2.writeText('hello2');
    await from3.writeText('hello3');

    await dir1.copyTo(dir2);

    const to1 = fs.path(dir2, 'file1.txt');
    const to2 = fs.path(dir2, 'file2.txt');
    const to3 = fs.path(dir2, 'nest', 'file.txt');
    expect(await from1.exists()).toBeTruthy();
    expect(await from2.exists()).toBeTruthy();
    expect(await from3.exists()).toBeTruthy();
    expect(await to1.readText()).toBe('hello1');
    expect(await to2.readText()).toBe('hello2');
    expect(await to3.readText()).toBe('hello3');

    await dir1.remove({ recursive: true });
    await dir2.remove({ recursive: true });
  });

  it('should move', async () => {
    const from = fs.path(temp, 'copied.txt');
    const to = fs.path(temp, 'pasted.txt');

    await from.writeText('hello');
    await from.moveTo(to);

    expect(await from.exists()).toBeFalsy();
    expect(await to.readText()).toBe('hello');

    await to.remove();
  });

  it('should move directory', async () => {
    const dir1 = fs.path(temp, 'dir3');
    const dir2 = fs.path(temp, 'dir4');

    const from1 = fs.path(dir1, 'file1.txt');
    const from2 = fs.path(dir1, 'file2.txt');
    const from3 = fs.path(dir1, 'nest', 'file.txt');

    await fs.path(dir1).mkdir();
    await fs.path(dir1, 'nest').mkdir();
    await from1.writeText('hello1');
    await from2.writeText('hello2');
    await from3.writeText('hello3');

    await dir1.moveTo(dir2);

    const to1 = fs.path(dir2, 'file1.txt');
    const to2 = fs.path(dir2, 'file2.txt');
    const to3 = fs.path(dir2, 'nest', 'file.txt');
    expect(await from1.exists()).toBeFalsy();
    expect(await from2.exists()).toBeFalsy();
    expect(await from3.exists()).toBeFalsy();
    expect(await to1.readText()).toBe('hello1');
    expect(await to2.readText()).toBe('hello2');
    expect(await to3.readText()).toBe('hello3');

    await dir1.remove({ recursive: true });
    await dir2.remove({ recursive: true });
  });
});
