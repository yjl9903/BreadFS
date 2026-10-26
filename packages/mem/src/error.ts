import { BreadFSError, type BreadFSErrorContext } from '@breadfs/core';

export interface MemErrorSource {
  provider: 'mem';
}

declare module '@breadfs/core' {
  interface BreadFSErrorSourceMap {
    mem: MemErrorSource;
  }
}

export function normalizeMemError(error: unknown, context: BreadFSErrorContext): BreadFSError {
  if (error instanceof BreadFSError) return error.withContext(context);

  const raw = typeof error === 'object' && error !== null ? error : {};
  const code = 'code' in raw && typeof raw.code === 'string' ? raw.code : undefined;

  return new BreadFSError(error, {
    ...context,
    code: code ?? 'ERR_BREADFS_UNKNOWN',
    source: { provider: 'mem' }
  });
}
