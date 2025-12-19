import { describe, it, expect } from 'vitest';

import { BreadFS } from '@breadfs/core';

import { unzipSync } from 'fflate';

import { MemProvider } from '../src';

describe('MemFS provider', () => {
  it('should construct instance', () => {
    const fs = BreadFS.of(new MemProvider());
    expect(fs.provider.name).toBe('mem');
  });

  it('should read initial json content', async () => {
    const fs = BreadFS.of(new MemProvider({ json: { '/hello.txt': 'world' } }));
    expect(await fs.path('/hello.txt').readText()).toBe('world');
  });

  it('should list recursively', async () => {
    const fs = BreadFS.of(new MemProvider());
    const root = fs.path('/workspace');
    await root.mkdir();

    const nested = root.join('nested');
    await nested.mkdir();
    const file = nested.join('file.txt');
    await file.writeText('content');

    const files = (await root.list({ recursive: true })).map((p) => p.toString()).sort();
    expect(files).toEqual(['/workspace/nested', '/workspace/nested/file.txt']);
  });

  it('should copy and move files', async () => {
    const fs = BreadFS.of(new MemProvider());
    const root = fs.path('/copy');
    await root.mkdir();

    const src = root.join('a.txt');
    await src.writeText('hello');

    const dst = root.join('b.txt');
    await src.copyTo(dst);
    expect(await dst.readText()).toBe('hello');

    const moved = root.join('c.txt');
    await dst.moveTo(moved);
    expect(await moved.readText()).toBe('hello');
    expect(await dst.exists()).toBeFalsy();
  });

  it('should zip directory', async () => {
    const fs = BreadFS.of(new MemProvider());

    const root = fs.path('/zip');
    await root.mkdir();
    await root.join('file.txt').writeText('hello');
    await root.join('dir').mkdir();
    await root.join('dir', 'nested.txt').writeText('world');

    const zipped = await fs.provider.zip('/zip');
    const unzipped = unzipSync(zipped);

    expect(Object.keys(unzipped).sort()).toEqual(['dir/', 'dir/nested.txt', 'file.txt']);
    expect(new TextDecoder().decode(unzipped['file.txt'])).toBe('hello');
    expect(new TextDecoder().decode(unzipped['dir/nested.txt'])).toBe('world');
  });
});
