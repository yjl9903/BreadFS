import { afterEach, describe, expect, it, vi } from 'vitest';

import { BreadFS, BreadFSError, isNotFound, NOT_FOUND_CODE, NotFoundError } from '@breadfs/core';

import { AliyunDriveError } from '../src/error';
import { AliyunLimiter } from '../src/limiter';
import { AliyunDriveProvider } from '../src';

const REFRESH = 'https://refresh.example/renew';
const API = 'https://api.example';

type Mode = 'tree' | 'auth' | 'api-not-found' | 'http-failure';

const tree: Record<string, Array<{ file_id: string; name: string; type: 'file' | 'folder' }>> = {
  root: [{ file_id: 'anime-id', name: 'anime', type: 'folder' }],
  'anime-id': [{ file_id: 'ep-id', name: 'episode.mkv', type: 'file' }]
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function installFetch(mode: Mode) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith(REFRESH)) {
        return json({ refresh_token: 'refresh-token', access_token: 'access-token' });
      }

      if (url.endsWith('/adrive/v1.0/user/getDriveInfo')) {
        return json({ default_drive_id: 'drive-1', user_id: 'user-1' });
      }

      if (url.endsWith('/adrive/v1.0/openFile/list')) {
        if (mode === 'auth') {
          return json({ code: 'AccessTokenInvalid', message: 'token invalid' }, 401);
        }
        if (mode === 'api-not-found') {
          return json(
            { code: 'NotFound.FileId', message: 'The resource file_id cannot be found.' },
            400
          );
        }
        if (mode === 'http-failure') {
          return new Response('bad gateway', { status: 500 });
        }

        const body = init?.body
          ? (JSON.parse(String(init.body)) as { parent_file_id?: string })
          : {};
        const parentId = body.parent_file_id ?? 'root';
        return json({ items: tree[parentId] ?? [], next_marker: '' });
      }

      return new Response('unexpected', { status: 500 });
    })
  );
}

function createFS(mode: Mode) {
  installFetch(mode);
  return BreadFS.of(
    new AliyunDriveProvider({
      refresh: { token: 'refresh-token', endpoint: REFRESH },
      apiUrl: API
    })
  );
}

async function capture(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected to throw');
}

describe('AliyunDrive missing paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports a missing subject directory as NotFoundError', async () => {
    vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue(undefined);
    const fs = createFS('tree');

    const error = await capture(() => fs.list('/anime/missing-subject'));

    expect(isNotFound(error)).toBe(true);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(BreadFSError);
    expect((error as NotFoundError).code).toBe(NOT_FOUND_CODE);
    expect((error as NotFoundError).path).toBe('/anime/missing-subject');
    expect((error as Error).message).toBe('/anime/missing-subject not found');
  });

  it('lists a directory that exists', async () => {
    vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue(undefined);
    const fs = createFS('tree');

    const files = (await fs.list('/anime')).map((file) => file.toString());
    expect(files).toEqual(['/anime/episode.mkv']);
    expect(await fs.path('/anime/missing-subject').exists()).toBe(false);
  });

  it('does not treat a file path as a missing directory', async () => {
    vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue(undefined);
    const fs = createFS('tree');

    const error = await capture(() => fs.list('/anime/episode.mkv'));

    expect(isNotFound(error)).toBe(false);
    expect(error).toBeInstanceOf(BreadFSError);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toContain('is not a directory');
    expect((error as BreadFSError).code).toBeUndefined();
  });

  it('maps Aliyun NotFound API codes and keeps auth and HTTP failures distinct', async () => {
    vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue(undefined);

    const missing = await capture(() => createFS('api-not-found').list('/anime'));
    expect(isNotFound(missing)).toBe(true);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect((missing as NotFoundError).cause).toBeInstanceOf(AliyunDriveError);
    expect(((missing as NotFoundError).cause as AliyunDriveError).code).toBe('NotFound.FileId');

    const auth = await capture(() => createFS('auth').list('/anime'));
    expect(isNotFound(auth)).toBe(false);
    expect(auth).toBeInstanceOf(BreadFSError);
    expect(auth).not.toBeInstanceOf(NotFoundError);
    expect((auth as BreadFSError).code).toBe('AccessTokenInvalid');
    expect((auth as Error).message).toContain('AccessTokenInvalid');

    const http = await capture(() => createFS('http-failure').list('/anime'));
    expect(isNotFound(http)).toBe(false);
    expect(http).not.toBeInstanceOf(NotFoundError);
    expect((http as BreadFSError).code).toBeUndefined();
    expect((http as Error).message).toContain('failed to request');

    const exists = createFS('auth');
    const existsError = await capture(() => exists.path('/anime').exists());
    expect(isNotFound(existsError)).toBe(false);
    expect((existsError as BreadFSError).code).toBe('AccessTokenInvalid');
  });

  it('does not turn an auth failure during copy into a missing path', async () => {
    vi.spyOn(AliyunLimiter.prototype, 'wait').mockResolvedValue(undefined);
    const fs = createFS('auth');

    const error = await capture(() => fs.copy('/anime/episode.mkv', '/anime/copy.mkv'));

    expect(isNotFound(error)).toBe(false);
    expect((error as BreadFSError).code).toBe('AccessTokenInvalid');
  });
});
