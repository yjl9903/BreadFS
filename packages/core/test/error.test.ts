import { describe, it, expect } from 'vitest';
import { BreadFS, BreadFSError, type BreadFSProvider } from '../src';

function provider(overrides: Partial<BreadFSProvider<'fixture'>> = {}): BreadFSProvider<'fixture'> {
  return {
    name: 'fixture',
    ...overrides
  } as BreadFSProvider<'fixture'>;
}

const missing = () =>
  Object.assign(new Error('missing'), { code: 'ENOENT', syscall: 'open', errno: -2 });

describe('error contract', () => {
  it('stores string paths for both Path and string inputs', async () => {
    const fs = BreadFS.of(
      provider({
        stat: async () => {
          throw new Error('failed');
        }
      })
    );
    const input = fs.path('/file');
    const fromPath = await fs.stat(input).catch((error) => error);
    expect(fromPath.path).toBe('/file');
    const fromString = await fs.stat('/file').catch((error) => error);
    expect(fromString.path).toBe('/file');
  });

  it('stores source and destination strings in unknown copy failures', async () => {
    const fs = BreadFS.of(
      provider({
        copy: async () => {
          throw new Error('failed');
        }
      })
    );
    const source = fs.path('/src');
    const destination = fs.path('/dst');
    const error = await fs.copy(source, destination).catch((error) => error);
    expect(error.path).toBe('/src');
    expect(error.dest).toBe('/dst');
  });

  it('keeps the original error and its cause without leaking native fields', async () => {
    const cause = new Error('root cause');
    const original = Object.assign(missing(), { cause });
    const expected = new BreadFSError(original, {
      code: 'ENOENT',
      operation: 'stat',
      path: '/actual',
      source: { provider: 'core' }
    });
    const fs = BreadFS.of(
      provider({
        readFile: async () => {
          throw expected;
        },
        readFileSync: () => {
          throw expected;
        }
      })
    );
    const error = await fs.readFile('/missing').catch((error) => error);
    expect(error).toBe(expected);
    let syncError: unknown;
    try {
      fs.readFileSync('/alias');
    } catch (error) {
      syncError = error;
    }
    expect(syncError).toBe(expected);
    expect(error).toMatchObject({
      name: 'BreadFSError',
      code: 'ENOENT',
      operation: 'stat',
      path: '/actual',
      source: { provider: 'core' }
    });
    expect(error.cause).toBe(original);
    expect(error.raw).toBe(original);
    expect(error.cause.cause).toBe(cause);
    expect(error).not.toHaveProperty('errno');
    expect(error).not.toHaveProperty('syscall');
  });

  it('wraps unclassified thrown values as unknown errors', async () => {
    for (const value of [null, undefined, 0, 'failed', { detail: 'failed' }, missing()]) {
      const fs = BreadFS.of(
        provider({
          stat: async () => {
            throw value;
          }
        })
      );
      const error = await fs.stat('/file').catch((error) => error);
      expect(error).toMatchObject({
        code: 'ERR_BREADFS_UNKNOWN',
        operation: 'stat',
        path: '/file',
        source: { provider: 'core' }
      });
      expect(error.cause).toBe(value);
    }
  });

  it('normalizes synchronous operations and distinguishes missing capabilities', () => {
    const fs = BreadFS.of(
      provider({
        statSync: () => {
          throw new BreadFSError(missing(), {
            code: 'ENOENT',
            operation: 'statSync',
            path: '/missing',
            source: { provider: 'core' }
          });
        }
      })
    );
    expect(() => fs.statSync('/missing')).toThrowError(
      expect.objectContaining({
        code: 'ENOENT',
        operation: 'statSync',
        source: { provider: 'core' }
      })
    );
    expect(() => fs.readFileSync('/file')).toThrowError(
      expect.objectContaining({
        code: 'ENOTSUP',
        operation: 'readFileSync',
        source: { provider: 'core' }
      })
    );
  });

  it('wraps unclassified deferred read errors', async () => {
    const fs = BreadFS.of(
      provider({
        createReadStream: () =>
          new ReadableStream({
            pull(controller) {
              controller.error(missing());
            }
          })
      })
    );
    await expect(fs.createReadStream('/missing').getReader().read()).rejects.toMatchObject({
      code: 'ERR_BREADFS_UNKNOWN',
      operation: 'createReadStream',
      path: '/missing',
      source: { provider: 'core' }
    });
  });

  it.each(['write', 'close'] as const)('normalizes deferred %s errors', async (stage) => {
    const fs = BreadFS.of(
      provider({
        createWriteStream: () =>
          new WritableStream({
            [stage]() {
              throw Object.assign(new Error('full'), { code: 'ENOSPC' });
            }
          })
      })
    );
    const writer = fs.createWriteStream('/file').getWriter();
    const action = stage === 'write' ? writer.write(new Uint8Array([1])) : writer.close();
    await expect(action).rejects.toMatchObject({
      code: 'ERR_BREADFS_UNKNOWN',
      operation: 'createWriteStream',
      source: { provider: 'core' }
    });
    await expect(writer.closed).rejects.toBeInstanceOf(BreadFSError);
  });

  it.each([false, true])('reports read errors through closed (pending read=%s)', async (pending) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const source = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      }
    });
    const fs = BreadFS.of(provider({ createReadStream: () => source }));
    const reader = fs.createReadStream('/file').getReader();
    const closed = reader.closed.catch((error) => error);
    const reading = pending ? reader.read().catch((error) => error) : undefined;
    const original = missing();

    controller.error(original);

    const error = await closed;
    expect(error).toBeInstanceOf(BreadFSError);
    expect(error).toMatchObject({
      operation: 'createReadStream',
      path: '/file',
      cause: original
    });
    if (reading) expect(await reading).toBe(error);
    await expect(reader.read()).rejects.toBe(error);
    expect(source.locked).toBe(false);
  });

  it.each([false, true])('aborts an in-flight write (abort fails=%s)', async (fails) => {
    let controller!: WritableStreamDefaultController;
    const started = Promise.withResolvers<void>();
    const reason = new Error('cancelled');
    const failure = new Error('abort failed');
    const reasons: unknown[] = [];
    const target = new WritableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
      write() {
        started.resolve();
        return new Promise<void>((resolve) => {
          controller.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
      abort(value) {
        reasons.push(value);
        if (fails) throw failure;
      }
    });
    const fs = BreadFS.of(provider({ createWriteStream: () => target }));
    const writer = fs.createWriteStream('/file').getWriter();
    const closed = writer.closed.catch((error) => error);
    const writing = writer.write(new Uint8Array([1]));
    await started.promise;

    const aborting = writer.abort(reason);
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe(reason);
    if (fails) {
      await expect(aborting).rejects.toMatchObject({
        name: 'BreadFSError',
        operation: 'createWriteStream',
        path: '/file',
        cause: failure
      });
    } else {
      await expect(aborting).resolves.toBeUndefined();
    }
    await expect(writing).resolves.toBeUndefined();
    expect(await closed).toBe(reason);
    expect(reasons).toEqual([reason]);
    expect(target.locked).toBe(false);
  });

  it('cancels a pending read without reporting lock release as a failure', async () => {
    const started = Promise.withResolvers<void>();
    const source = new ReadableStream<Uint8Array>(
      { pull: () => started.resolve() },
      { highWaterMark: 0 }
    );
    const fs = BreadFS.of(provider({ createReadStream: () => source }));
    const reader = fs.createReadStream('/file').getReader();
    const reading = reader.read();
    await started.promise;

    await reader.cancel();
    await expect(reading).resolves.toEqual({ done: true, value: undefined });
    await expect(reader.closed).resolves.toBeUndefined();
    expect(source.locked).toBe(false);
  });

  it.each(['before wrapping', 'without a pending read', 'with a pending read'])(
    'reports an empty source closing %s',
    async (timing) => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const started = Promise.withResolvers<void>();
      const source = new ReadableStream<Uint8Array>(
        {
          start(value) {
            controller = value;
          },
          pull: () => started.resolve()
        },
        { highWaterMark: 0 }
      );
      if (timing === 'before wrapping') controller.close();
      const fs = BreadFS.of(provider({ createReadStream: () => source }));
      const reader = fs.createReadStream('/file').getReader();
      const reading = timing === 'with a pending read' ? reader.read() : undefined;
      if (reading) await started.promise;
      if (timing !== 'before wrapping') controller.close();

      await expect(reader.closed).resolves.toBeUndefined();
      if (reading) await expect(reading).resolves.toEqual({ done: true, value: undefined });
      expect(source.locked).toBe(false);
    }
  );

  it.each([false, true])(
    'closes after the last chunk without another read (buffered=%s)',
    async (buffered) => {
      const chunks = [new Uint8Array([1]), new Uint8Array([2])];
      let index = 0;
      const source = new ReadableStream<Uint8Array>(
        {
          start(controller) {
            if (buffered) {
              for (const chunk of chunks) controller.enqueue(chunk);
              controller.close();
            }
          },
          pull(controller) {
            controller.enqueue(chunks[index++]);
            if (index === chunks.length) controller.close();
          }
        },
        { highWaterMark: 0 }
      );
      const fs = BreadFS.of(provider({ createReadStream: () => source }));
      const reader = fs.createReadStream('/file').getReader();

      for (const chunk of chunks) {
        await expect(reader.read()).resolves.toEqual({ done: false, value: chunk });
      }
      await expect(reader.closed).resolves.toBeUndefined();
      expect(source.locked).toBe(false);
      await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
    }
  );

  it('passes classified stream errors through unchanged', async () => {
    const expected = new BreadFSError('denied', {
      code: 'EACCES',
      operation: 'download',
      path: '/actual',
      source: { provider: 'core' }
    });
    const fs = BreadFS.of(
      provider({
        createReadStream: () =>
          new ReadableStream({
            pull(controller) {
              controller.error(expected);
            }
          }),
        createWriteStream: () =>
          new WritableStream({
            write() {
              throw expected;
            }
          })
      })
    );
    await expect(fs.createReadStream('/alias').getReader().read()).rejects.toBe(expected);
    const writer = fs.createWriteStream('/alias').getWriter();
    await expect(writer.write(new Uint8Array([1]))).rejects.toBe(expected);
    await expect(writer.closed).rejects.toBe(expected);
  });

  it('forwards read cancellation and write abortion', async () => {
    const reason = new Error('cancelled');
    let cancelled: unknown;
    let aborted: unknown;
    const fs = BreadFS.of(
      provider({
        createReadStream: () =>
          new ReadableStream({
            cancel(value) {
              cancelled = value;
            }
          }),
        createWriteStream: () =>
          new WritableStream({
            abort(value) {
              aborted = value;
            }
          })
      })
    );
    await fs.createReadStream('/file').cancel(reason);
    await fs.createWriteStream('/file').abort(reason);
    expect(cancelled).toBe(reason);
    expect(aborted).toBe(reason);
  });

  it('does not convert failures of existsSync fallback into missing entries', () => {
    const fs = BreadFS.of(
      provider({
        statSync() {
          throw Object.assign(new Error('denied'), { code: 'EACCES' });
        }
      })
    );
    expect(() => fs.existsSync('/private')).toThrowError(
      expect.objectContaining({ code: 'ERR_BREADFS_UNKNOWN' })
    );
  });
});
