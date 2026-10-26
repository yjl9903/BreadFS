import { normalizeWebDAVError } from '../src/error';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BreadFS, BreadFSError, type BreadFSProvider } from '@breadfs/core';
import { WebDAVProvider } from '../src';

function setup() {
  const provider = new WebDAVProvider('http://webdav.invalid');
  return { provider, fs: BreadFS.of(provider) };
}
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
afterEach(() => vi.restoreAllMocks());

describe('WebDAV errors', () => {
  it('classifies direct provider calls and deferred stream failures', async () => {
    const { provider } = setup();
    vi.spyOn(provider.client, 'getFileContents').mockRejectedValue(httpError(403));
    vi.spyOn(provider.client, 'deleteFile').mockRejectedValue(httpError(500));
    vi.spyOn(provider.client, 'createReadStream').mockImplementation(() => {
      const stream = new PassThrough();
      queueMicrotask(() => stream.destroy(httpError(404)));
      return stream;
    });
    await expect(provider.readFile('/file', {})).rejects.toMatchObject({
      code: 'EACCES',
      operation: 'readFile',
      source: { provider: 'webdav', status: 403 }
    });
    await expect(provider.remove('/file', { force: true })).rejects.toMatchObject({
      code: 'ERR_BREADFS_REMOTE',
      operation: 'remove',
      source: { provider: 'webdav', status: 500 }
    });
    await expect(provider.createReadStream('/missing').getReader().read()).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createReadStream',
      source: { provider: 'webdav', status: 404 }
    });
  });

  it.each([
    [401, 'ERR_BREADFS_AUTH'],
    [403, 'EACCES'],
    [404, 'ENOENT'],
    [423, 'EBUSY'],
    [429, 'ERR_BREADFS_RATE_LIMITED'],
    [507, 'ENOSPC'],
    [500, 'ERR_BREADFS_REMOTE'],
    [409, 'ERR_BREADFS_REMOTE'],
    [412, 'ERR_BREADFS_REMOTE']
  ])('maps read status %s', async (status, code) => {
    const { provider, fs } = setup();
    const original = httpError(Number(status));
    vi.spyOn(provider.client, 'getFileContents').mockRejectedValue(original);
    const error = await fs.readFile('/file').catch((error) => error);
    expect(error).toMatchObject({
      code,
      operation: 'readFile',
      path: '/file',
      source: { provider: 'webdav', status }
    });
    expect(error.cause).toBe(original);
    expect(error).not.toHaveProperty('status');
  });

  it.each([401, 403, 500])('does not swallow remove status %s, even with force', async (status) => {
    const { provider, fs } = setup();
    vi.spyOn(provider.client, 'deleteFile').mockRejectedValue(httpError(status));
    await expect(fs.remove('/file', { force: true })).rejects.toMatchObject({
      source: { provider: 'webdav', status }
    });
  });

  it('only suppresses missing entries in forced removals', async () => {
    const { provider, fs } = setup();
    vi.spyOn(provider.client, 'deleteFile').mockRejectedValue(httpError(404));
    await expect(fs.remove('/file')).resolves.toBeUndefined();
    await expect(fs.remove('/file', { force: false })).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses operation context for MKCOL conflicts', async () => {
    const { provider, fs } = setup();
    vi.spyOn(provider.client, 'createDirectory').mockRejectedValue(httpError(409));
    await expect(fs.mkdir('/parent/dir')).rejects.toMatchObject({
      code: 'ENOENT',
      source: { status: 409 }
    });
  });

  it('identifies overwrite conflicts only when overwrite was disabled', async () => {
    const { provider, fs } = setup();
    const copy = vi.spyOn(provider.client, 'copyFile').mockRejectedValue(httpError(412));
    await expect(
      fs.copy('/src', '/dst', { overwrite: false, errorOnExist: true })
    ).rejects.toMatchObject({ code: 'EEXIST', dest: '/dst' });
    expect(copy).toHaveBeenCalledWith('/src', '/dst', { overwrite: false });
    await expect(fs.copy('/src', '/dst', { overwrite: false })).resolves.toBeUndefined();
    await expect(fs.copy('/src', '/dst', { overwrite: true })).rejects.toMatchObject({
      code: 'ERR_BREADFS_REMOTE'
    });
  });

  it('preserves default move conflicts and explicit overwrite behavior', async () => {
    const { provider, fs } = setup();
    const move = vi.spyOn(provider.client, 'moveFile').mockRejectedValue(httpError(412));
    await expect(fs.move('/src', '/dst')).rejects.toMatchObject({
      code: 'EEXIST',
      operation: 'move',
      dest: '/dst'
    });
    expect(move).toHaveBeenLastCalledWith('/src', '/dst', { overwrite: false });
    await expect(fs.move('/src', '/dst', { overwrite: true })).rejects.toMatchObject({
      code: 'ERR_BREADFS_REMOTE'
    });
    expect(move).toHaveBeenLastCalledWith('/src', '/dst', { overwrite: true });
  });

  it.each([false, true])(
    'keeps destination provenance during cross-provider copy (stream=%s)',
    async (stream) => {
      const { provider, fs: target } = setup();
      vi.spyOn(provider.client, 'exists').mockResolvedValue(false);
      vi.spyOn(provider.client, 'stat').mockRejectedValue(httpError(404));
      vi.spyOn(provider.client, 'putFileContents').mockRejectedValue(httpError(403));
      vi.spyOn(provider.client, 'createWriteStream').mockImplementation(
        () =>
          new PassThrough({
            transform(_chunk, _encoding, callback) {
              callback(httpError(403));
            }
          })
      );
      const srcProvider: Partial<BreadFSProvider<'node'>> = {
        name: 'node',
        stat: async () => ({
          path: '/src',
          size: 1,
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false,
          mtime: undefined,
          birthtime: undefined
        }),
        readFile: async () => new Uint8Array([1]),
        createReadStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1]));
              controller.close();
            }
          })
      };
      const src = BreadFS.of(srcProvider as BreadFSProvider<'node'>);
      await expect(
        src.copy('/src', target.path('/dst'), stream ? { fallback: { stream: {} } } : {})
      ).rejects.toMatchObject({
        code: 'EACCES',
        operation: stream ? 'createWriteStream' : 'writeFile',
        path: '/dst',
        dest: undefined,
        source: { provider: 'webdav', status: 403 }
      });
    }
  );

  it('does not treat destination stat failures as permission to write', async () => {
    const { provider, fs: target } = setup();
    vi.spyOn(provider.client, 'stat').mockRejectedValue(httpError(403));
    const write = vi.spyOn(provider.client, 'putFileContents');
    const src = BreadFS.of({
      name: 'node',
      stat: async () => ({
        path: '/src',
        size: 1,
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        mtime: undefined,
        birthtime: undefined
      })
    } as Partial<BreadFSProvider<'node'>> as BreadFSProvider<'node'>);
    await expect(src.copy('/src', target.path('/dst'), { overwrite: true })).rejects.toMatchObject({
      code: 'EACCES',
      source: { provider: 'webdav' }
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('waits for the upload acknowledgement and reports late HTTP rejection', async () => {
    const { provider, fs } = setup();
    const stream = new PassThrough();
    stream.resume();
    vi.spyOn(provider.client, 'createWriteStream').mockReturnValue(stream);
    const writer = provider.createWriteStream('/file', {}).getWriter();
    await writer.write(new Uint8Array([1]));
    let settled = false;
    const closing = writer.close().finally(() => {
      settled = true;
    });
    const assertion = expect(closing).rejects.toMatchObject({
      code: 'ENOSPC',
      source: { provider: 'webdav', status: 507 }
    });
    await new Promise<void>((resolve) =>
      stream.writableFinished ? resolve() : stream.once('finish', resolve)
    );
    expect(settled).toBe(false);
    stream.emit('error', httpError(507));
    await assertion;
    await expect(writer.closed).rejects.toBeInstanceOf(BreadFSError);
  });
});

describe('transport errors', () => {
  it('handles cause chains, cancellation and cyclic causes', () => {
    const context = { operation: 'readFile', path: '/file' };
    const original = new TypeError('fetch failed', {
      cause: Object.assign(new Error(), { code: 'ECONNRESET' })
    });
    expect(normalizeWebDAVError(original, context).code).toBe('ECONNRESET');
    expect(normalizeWebDAVError(original, context).cause).toBe(original);
    expect(normalizeWebDAVError(new DOMException('aborted', 'AbortError'), context).code).toBe(
      'ABORT_ERR'
    );
    const cyclic = new Error();
    cyclic.cause = cyclic;
    expect(normalizeWebDAVError(cyclic, context).code).toBe('ERR_BREADFS_UNKNOWN');
  });
});
