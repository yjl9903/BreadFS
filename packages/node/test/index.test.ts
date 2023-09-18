import { describe, it, expect } from 'vitest';

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

  it('should mkdir', async () => {
    const tempdir = fs.path('.temp/dir');
    await tempdir.mkdir();
    expect(await tempdir.exists()).toBeTruthy();
    await tempdir.remove();
    expect(await tempdir.exists()).toBeFalsy();
  });
});
