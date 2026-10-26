import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { BreadFS, BreadFSError } from '@breadfs/core';
import { NodeFS } from '../src';

let root: string;
const fs = BreadFS.of(NodeFS);
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'breadfs-error-test-'));
  await writeFile(join(root, 'file'), 'content');
  await mkdir(join(root, 'dir'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('native filesystem error integration', () => {
  it('stores source and destination error paths as strings', async () => {
    const error = await NodeFS.copy(join(root, 'missing'), join(root, 'target'), {}).catch(
      (error) => error
    );
    expect(error.path).toBe(join(root, 'missing'));
    expect(error.dest).toBe(join(root, 'target'));
  });

  it('classifies failures without a BreadFS wrapper', async () => {
    const path = join(root, 'missing');
    await expect(NodeFS.readFile(path, {})).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'readFile',
      path,
      source: { provider: 'node', syscall: 'open' }
    });
    expect(() => NodeFS.statSync(path, {})).toThrowError(
      expect.objectContaining({
        code: 'ENOENT',
        operation: 'statSync',
        source: expect.objectContaining({ provider: 'node' })
      })
    );
    await expect(NodeFS.createReadStream(path, {}).getReader().read()).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createReadStream',
      source: { provider: 'node' }
    });
    const writer = NodeFS.createWriteStream(join(root, 'missing', 'child'), {}).getWriter();
    await expect(writer.close()).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createWriteStream',
      source: { provider: 'node' }
    });
    await expect(writer.closed).rejects.toBeInstanceOf(BreadFSError);
  });

  it('preserves native error metadata only in source', async () => {
    const error = await fs.readFile(join(root, 'missing')).catch((error) => error);
    expect(error).toBeInstanceOf(BreadFSError);
    expect(error).toMatchObject({
      code: 'ENOENT',
      operation: 'readFile',
      source: { provider: 'node', code: 'ENOENT', syscall: 'open' }
    });
    expect(typeof error.source.errno).toBe('number');
    expect(error).not.toHaveProperty('errno');
    expect(error.cause.code).toBe('ENOENT');
    expect(error.path).toBe(join(root, 'missing'));
  });

  it('normalizes native stream errors after stream creation', async () => {
    await expect(
      fs.createReadStream(join(root, 'missing')).getReader().read()
    ).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createReadStream',
      source: { provider: 'node' }
    });
  });

  it('keeps directory mismatches and synchronous error context', async () => {
    await expect(fs.list(join(root, 'file'))).rejects.toMatchObject({
      code: 'ENOTDIR',
      operation: 'list'
    });
    expect(() => fs.statSync(join(root, 'missing'))).toThrowError(
      expect.objectContaining({ code: 'ENOENT', operation: 'statSync' })
    );
  });

  it('does not hide non-directory components in exists', async () => {
    await expect(fs.exists(join(root, 'missing'))).resolves.toBe(false);
    await expect(fs.exists(join(root, 'file', 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' });
    expect(() => fs.existsSync(join(root, 'file', 'child'))).toThrowError(
      expect.objectContaining({ code: 'ENOTDIR' })
    );
  });
});
