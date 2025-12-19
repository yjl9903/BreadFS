import { describe, it, expect } from 'vitest';

import { BreadFS } from '@breadfs/core';

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
});
