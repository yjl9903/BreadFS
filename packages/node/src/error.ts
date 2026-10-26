import { BreadFSError, type BreadFSErrorContext } from '@breadfs/core';

export interface NodeErrorSource {
  provider: 'node';
  code?: string;
  syscall?: string;
  errno?: number;
}

declare module '@breadfs/core' {
  interface BreadFSErrorSourceMap {
    node: NodeErrorSource;
  }
}

export function normalizeNodeError(error: unknown, context: BreadFSErrorContext): BreadFSError {
  if (error instanceof BreadFSError) return error.withContext(context);
  const raw = typeof error === 'object' && error !== null ? error : {};
  const code = 'code' in raw && typeof raw.code === 'string' ? raw.code : undefined;
  return new BreadFSError(error, {
    ...context,
    code: code ?? 'ERR_BREADFS_UNKNOWN',
    source: {
      provider: 'node',
      code,
      syscall: 'syscall' in raw && typeof raw.syscall === 'string' ? raw.syscall : undefined,
      errno: 'errno' in raw && typeof raw.errno === 'number' ? raw.errno : undefined
    }
  });
}
