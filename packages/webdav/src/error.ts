import { BreadFSError, type BreadFSErrorContext } from '@breadfs/core';

export interface WebDAVErrorSource {
  provider: 'webdav';
  status?: number;
  condition?: { namespace: string; name: string };
}

declare module '@breadfs/core' {
  interface BreadFSErrorSourceMap {
    webdav: WebDAVErrorSource;
  }
}

export function webDAVStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('status' in error && typeof error.status === 'number') return error.status;
  if (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  )
    return error.response.status;
  return undefined;
}

export function normalizeWebDAVError(error: unknown, context: BreadFSErrorContext): BreadFSError {
  if (error instanceof BreadFSError) return error.withContext(context);
  const status = webDAVStatus(error);
  let code = transportErrorCode(error) ?? 'ERR_BREADFS_UNKNOWN';
  if (status !== undefined) {
    code = 'ERR_BREADFS_REMOTE';
    if (status === 401) code = 'ERR_BREADFS_AUTH';
    else if (status === 403) code = 'EACCES';
    else if (status === 404) code = 'ENOENT';
    else if (status === 423) code = 'EBUSY';
    else if (status === 429) code = 'ERR_BREADFS_RATE_LIMITED';
    else if (status === 507) code = 'ENOSPC';
    // MKCOL has operation-specific meanings for these statuses (RFC 4918 §9.3).
    else if (status === 409 && context.operation === 'mkdir') code = 'ENOENT';
    else if (status === 405 && context.operation === 'mkdir') code = 'EEXIST';
  }
  return new BreadFSError(error, { ...context, code, source: { provider: 'webdav', status } });
}

/** Fetch can put transport errors in cause rather than on its outer TypeError. */
function transportErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  while (typeof error === 'object' && error !== null && !seen.has(error)) {
    seen.add(error);
    if ('name' in error && error.name === 'AbortError') return 'ABORT_ERR';
    if ('name' in error && error.name === 'TimeoutError') return 'ETIMEDOUT';
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    if (
      code &&
      /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|EPIPE|ABORT_ERR)$/.test(
        code
      )
    )
      return code;
    if (
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT'
    )
      return 'ETIMEDOUT';
    error = 'cause' in error ? error.cause : undefined;
  }
  return undefined;
}
