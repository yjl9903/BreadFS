import { normalizeAliyunDriveError } from '../src/error';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BreadFS, BreadFSError } from '@breadfs/core';
import { AliyunDriveProvider } from '../src';
import { AliyunLimiter } from '../src/limiter';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-request-id': 'request-123' }
  });
const entries = [
  { file_id: 'file-id', name: 'file', type: 'file', size: 1 },
  { file_id: 'folder-id', name: 'folder', type: 'folder' }
];
function responseFor(input: string | URL | Request) {
  const url = String(input);
  if (url.startsWith('https://refresh.invalid'))
    return json({ refresh_token: 'refresh-token', access_token: 'access-token' });
  if (url.endsWith('/getDriveInfo')) return json({ default_drive_id: 'drive-id' });
  if (url.endsWith('/list')) return json({ items: entries });
  throw new Error(`Unexpected test request: ${new URL(url).pathname}`);
}
const fetchMock = vi.fn<typeof fetch>();
function setup(rapidUpload = false) {
  return BreadFS.of(
    new AliyunDriveProvider({
      rapidUpload,
      refresh: { token: 'refresh-token', endpoint: 'https://refresh.invalid' }
    })
  );
}
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (input) => responseFor(input));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AliyunDrive errors', () => {
  it('classifies direct provider requests and streams', async () => {
    const provider = setup().provider;
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/list') ? json({ message: 'Forbidden' }, 403) : responseFor(input)
    );
    await expect(provider.stat('/file')).rejects.toMatchObject({
      code: 'EACCES',
      operation: 'stat',
      source: { provider: 'aliyundrive', status: 403 }
    });
    await expect(provider.exists('/file')).rejects.toMatchObject({
      code: 'EACCES',
      operation: 'exists',
      source: { provider: 'aliyundrive', status: 403 }
    });
    await expect(provider.createReadStream('/file', {}).getReader().read()).rejects.toMatchObject({
      code: 'EACCES',
      operation: 'createReadStream',
      source: { provider: 'aliyundrive', status: 403 }
    });
    const writer = provider.createWriteStream('/file', { contentLength: 10 }).getWriter();
    await expect(writer.close()).rejects.toMatchObject({
      code: 'EINVAL',
      operation: 'createWriteStream',
      source: { provider: 'aliyundrive' }
    });
    await expect(writer.closed).rejects.toBeInstanceOf(BreadFSError);
  });

  it('reports local path conditions without inventing provider error codes', async () => {
    const fs = setup();
    await expect(fs.stat('/missing')).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'stat',
      path: '/missing',
      source: { provider: 'aliyundrive' }
    });
    await expect(fs.readFile('/folder')).rejects.toMatchObject({
      code: 'EISDIR',
      operation: 'readFile'
    });
    await expect(fs.list('/file')).rejects.toMatchObject({ code: 'ENOTDIR', operation: 'list' });
    await expect(fs.stat('/file/child')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(fs.writeFile('/file/child', new Uint8Array())).rejects.toMatchObject({
      code: 'ENOTDIR'
    });
    await expect(fs.mkdir('/folder', { recursive: false })).rejects.toMatchObject({
      code: 'EEXIST'
    });
    await expect(fs.mkdir('/missing/child', { recursive: false })).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await expect(fs.exists('/missing')).resolves.toBe(false);
    await expect(fs.remove('/missing')).resolves.toBeUndefined();
    await expect(fs.remove('/missing', { force: false })).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    [403, 'EACCES'],
    [429, 'ERR_BREADFS_RATE_LIMITED'],
    [507, 'ENOSPC'],
    [500, 'ERR_BREADFS_REMOTE'],
    [404, 'ERR_BREADFS_REMOTE']
  ])('retains HTTP %s and business details', async (status, code) => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/list')
        ? json({ code: 'ServiceSpecificFailure', message: 'remote failure' }, Number(status))
        : responseFor(input)
    );
    const fs = setup();
    const error = await fs.stat('/file').catch((error) => error);
    expect(error).toBeInstanceOf(BreadFSError);
    expect(error).toMatchObject({
      code,
      source: {
        provider: 'aliyundrive',
        code: 'ServiceSpecificFailure',
        status,
        requestId: 'request-123'
      }
    });
    expect(error).not.toHaveProperty('status');
    expect(error).not.toHaveProperty('requestId');
    await expect(fs.exists('/file')).rejects.toMatchObject({ code });
    await expect(fs.copy('/file', '/other')).rejects.toMatchObject({
      code,
      operation: 'copy',
      dest: '/other'
    });
  });

  it('refreshes and retries an HTTP 401 once, preserving the final error', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/list')
        ? json({ code: 'AccessTokenExpired', message: 'expired' }, 401)
        : responseFor(input)
    );
    await expect(setup().stat('/file')).rejects.toMatchObject({
      code: 'ERR_BREADFS_AUTH',
      source: { provider: 'aliyundrive', code: 'AccessTokenExpired', status: 401 }
    });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).startsWith('https://refresh.invalid'))
    ).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/list'))).toHaveLength(
      2
    );
  });

  it('recovers after a token refresh, including non-JSON 401 responses', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/list') && attempts++ === 0)
        return new Response('Unauthorized', { status: 401 });
      return responseFor(input);
    });
    await expect(setup().exists('/file')).resolves.toBe(true);
    expect(attempts).toBe(2);
  });

  it('keeps non-JSON response status and parsing cause', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/list')
        ? new Response('<html>Unavailable</html>', {
            status: 503,
            headers: { 'x-request-id': 'gateway-id' }
          })
        : responseFor(input)
    );
    const error = await setup()
      .stat('/file')
      .catch((error) => error);
    expect(error).toMatchObject({
      code: 'ERR_BREADFS_REMOTE',
      source: { status: 503, requestId: 'gateway-id' }
    });
    expect(error.cause.cause).toBeInstanceOf(SyntaxError);
  });

  it('retains network errors and never reports them as missing', async () => {
    const original = new TypeError('fetch failed', {
      cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' })
    });
    fetchMock.mockRejectedValue(original);
    const error = await setup()
      .exists('/file')
      .catch((error) => error);
    expect(error).toMatchObject({
      code: 'ECONNRESET',
      operation: 'exists',
      source: { provider: 'aliyundrive' }
    });
    expect(error.cause).toBe(original);
  });

  it('allows a caller to retry after initialization fails', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/getDriveInfo') && attempts++ === 0) {
        return json({ message: 'Unavailable' }, 503);
      }
      return responseFor(input);
    });
    const fs = setup();
    await expect(fs.exists('/file')).rejects.toMatchObject({ code: 'ERR_BREADFS_REMOTE' });
    await expect(fs.exists('/file')).resolves.toBe(true);
  });

  it('retains the prehash upload control flow for non-2xx business responses', async () => {
    const creates: Record<string, unknown>[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/create')) {
        creates.push(JSON.parse(String(init?.body)));
        return creates.length === 1
          ? json({ code: 'PreHashMatched', message: 'Continue with proof' }, 409)
          : json({ rapid_upload: true, file_id: 'new-id', upload_id: 'upload-id' });
      }
      if (String(input).endsWith('/complete')) return json({});
      return responseFor(input);
    });
    await expect(
      setup(true).writeFile('/new', new Uint8Array(103 * 1024))
    ).resolves.toBeUndefined();
    expect(creates).toHaveLength(2);
    expect(creates[0]).toHaveProperty('pre_hash');
    expect(creates[1]).not.toHaveProperty('pre_hash');
    expect(creates[1]).toHaveProperty('proof_code');
  });

  it('normalizes deferred stream failures', async () => {
    const fs = setup();
    await expect(fs.createReadStream('/missing').getReader().read()).rejects.toMatchObject({
      code: 'ENOENT',
      operation: 'createReadStream',
      source: { provider: 'aliyundrive' }
    });
    const writer = fs.createWriteStream('/file', { contentLength: 10 }).getWriter();
    await expect(writer.close()).rejects.toMatchObject({
      code: 'EINVAL',
      operation: 'createWriteStream'
    });
    await expect(writer.closed).rejects.toBeInstanceOf(BreadFSError);
  });
});

describe('transport errors', () => {
  it('handles cause chains, cancellation and cyclic causes', () => {
    const context = { operation: 'readFile', path: '/file' };
    const original = new TypeError('fetch failed', {
      cause: Object.assign(new Error(), { code: 'ECONNRESET' })
    });
    expect(normalizeAliyunDriveError(original, context).code).toBe('ECONNRESET');
    expect(normalizeAliyunDriveError(original, context).cause).toBe(original);
    expect(normalizeAliyunDriveError(new DOMException('aborted', 'AbortError'), context).code).toBe(
      'ABORT_ERR'
    );
    const cyclic = new Error();
    cyclic.cause = cyclic;
    expect(normalizeAliyunDriveError(cyclic, context).code).toBe('ERR_BREADFS_UNKNOWN');
  });
});
