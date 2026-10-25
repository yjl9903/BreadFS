import { describe, expect, it } from 'vitest';

import type { BreadFSProvider } from '../src';
import {
  BreadFS,
  BreadFSError,
  isNotFound,
  NOT_FOUND_CODE,
  NotFoundError,
  toBreadFSError
} from '../src';

describe('isNotFound', () => {
  it('recognizes NotFoundError and ENOENT without reading the message', () => {
    const missing = new NotFoundError('/anime/subject not found', { path: '/anime/subject' });
    expect(missing).toBeInstanceOf(BreadFSError);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(missing.code).toBe(NOT_FOUND_CODE);
    expect(missing.path).toBe('/anime/subject');
    expect(isNotFound(missing)).toBe(true);

    const enoent = Object.assign(new Error('ENOENT: no such file or directory'), {
      code: 'ENOENT',
      path: '/anime/subject'
    });
    expect(isNotFound(enoent)).toBe(true);

    const wrapped = toBreadFSError(enoent);
    expect(wrapped).toBeInstanceOf(NotFoundError);
    expect(wrapped.code).toBe(NOT_FOUND_CODE);
    expect((wrapped as NotFoundError).path).toBe('/anime/subject');
    expect(wrapped.message).toBe(enoent.message);
    expect(isNotFound(wrapped)).toBe(true);
  });

  it('does not treat message text or other codes as not found', () => {
    const english = new Error('/anime/subject not found');
    const chinese = new Error('文件夹不存在');
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    const notDir = Object.assign(new Error('ENOTDIR: not a directory'), { code: 'ENOTDIR' });
    const unauthorized = Object.assign(new Error('Invalid response: 401 Unauthorized'), {
      status: 401,
      response: {}
    });
    const apiCode = Object.assign(new Error('AccessTokenInvalid:token'), {
      code: 'AccessTokenInvalid'
    });

    for (const error of [english, chinese, denied, notDir, unauthorized, apiCode]) {
      expect(isNotFound(error)).toBe(false);
      const wrapped = toBreadFSError(error);
      expect(wrapped).toBeInstanceOf(BreadFSError);
      expect(wrapped).not.toBeInstanceOf(NotFoundError);
      expect(isNotFound(wrapped)).toBe(false);
    }

    expect(toBreadFSError(denied).code).toBe('EACCES');
    expect(toBreadFSError(notDir).code).toBe('ENOTDIR');
    expect(toBreadFSError(apiCode).code).toBe('AccessTokenInvalid');
    expect(toBreadFSError(english).code).toBeUndefined();
  });

  it('recognizes WebDAV HTTP 404 and ignores other statuses', () => {
    const missing = Object.assign(new Error('Invalid response: 404 Not Found'), {
      status: 404,
      response: {}
    });
    const wrapped = toBreadFSError(missing);
    expect(isNotFound(wrapped)).toBe(true);
    expect(wrapped).toBeInstanceOf(NotFoundError);
    expect(wrapped.code).toBe(NOT_FOUND_CODE);
    expect(wrapped.message).toBe('Invalid response: 404 Not Found');
    expect(wrapped.name).toBe('Error');

    const forbidden = Object.assign(new Error('Invalid response: 403 Forbidden'), {
      status: 403,
      response: {}
    });
    expect(isNotFound(toBreadFSError(forbidden))).toBe(false);
  });

  it('walks the cause chain', () => {
    const root = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const wrapped = new Error('outer');
    wrapped.cause = root;
    expect(isNotFound(wrapped)).toBe(true);
    expect(toBreadFSError(wrapped)).toBeInstanceOf(NotFoundError);
  });
});

describe('BreadFS not-found normalization', () => {
  function fsWith(list: (path: string) => Promise<string[]>) {
    return BreadFS.of({
      name: 'fake',
      list
    } as unknown as BreadFSProvider<string>);
  }

  it('passes provider NotFoundError through list', async () => {
    const fs = fsWith(async () => {
      throw new NotFoundError('/anime/subject not found', { path: '/anime/subject' });
    });

    await expect(fs.list('/anime/subject')).rejects.toBeInstanceOf(NotFoundError);
    await expect(fs.list('/anime/subject')).rejects.toMatchObject({
      code: NOT_FOUND_CODE,
      path: '/anime/subject',
      message: '/anime/subject not found'
    });
  });

  it('maps provider ENOENT to NotFoundError and keeps other errors', async () => {
    const missing = fsWith(async () => {
      throw Object.assign(new Error('ENOENT: no such file or directory'), {
        code: 'ENOENT',
        path: '/missing'
      });
    });
    await expect(missing.list('/missing')).rejects.toMatchObject({
      code: NOT_FOUND_CODE,
      path: '/missing'
    });

    const denied = fsWith(async () => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    });
    try {
      await denied.list('/secret');
      expect.fail('expected list to throw');
    } catch (error) {
      expect(isNotFound(error)).toBe(false);
      expect(error).toBeInstanceOf(BreadFSError);
      expect(error).not.toBeInstanceOf(NotFoundError);
      expect((error as BreadFSError).code).toBe('EACCES');
    }
  });

  it('does not classify a "not found" message as a missing path', async () => {
    const fs = fsWith(async () => {
      throw new Error('/anime/subject not found');
    });

    try {
      await fs.list('/anime/subject');
      expect.fail('expected list to throw');
    } catch (error) {
      expect(isNotFound(error)).toBe(false);
      expect(error).toBeInstanceOf(BreadFSError);
      expect((error as BreadFSError).code).toBeUndefined();
    }
  });
});
