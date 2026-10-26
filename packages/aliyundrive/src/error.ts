import { BreadFSError, type BreadFSErrorContext } from '@breadfs/core';
import { TOKEN_ERROR_CODES } from './constants';

export interface AliyunDriveErrorSource {
  provider: 'aliyundrive';
  code?: string;
  status?: number;
  requestId?: string;
}

declare module '@breadfs/core' {
  interface BreadFSErrorSourceMap {
    aliyundrive: AliyunDriveErrorSource;
  }
}

/** Internal transport error; public callers receive a BreadFSError. */
export class AliyunDriveError extends Error {
  public readonly source: AliyunDriveErrorSource;

  public constructor(
    code?: string,
    message?: string,
    details: Omit<AliyunDriveErrorSource, 'provider' | 'code'> = {},
    options?: ErrorOptions
  ) {
    super(message ?? code ?? 'AliyunDrive error', options);
    this.name = 'AliyunDriveError';
    this.source = { provider: 'aliyundrive', code, ...details };
  }
}

export function normalizeAliyunDriveError(
  error: unknown,
  context: BreadFSErrorContext
): BreadFSError {
  if (error instanceof BreadFSError) return error.withContext(context);
  const source: AliyunDriveErrorSource =
    error instanceof AliyunDriveError ? error.source : { provider: 'aliyundrive' };
  let code = transportErrorCode(error) ?? 'ERR_BREADFS_UNKNOWN';
  if (error instanceof AliyunDriveError) {
    code = 'ERR_BREADFS_REMOTE';
    if (source.code && TOKEN_ERROR_CODES.has(source.code)) code = 'ERR_BREADFS_AUTH';
    else if (source.status === 401) code = 'ERR_BREADFS_AUTH';
    else if (source.status === 403) code = 'EACCES';
    else if (source.status === 429) code = 'ERR_BREADFS_RATE_LIMITED';
    else if (source.status === 507) code = 'ENOSPC';
    // An OpenAPI endpoint's HTTP 404 alone does not establish a missing file.
  }
  return new BreadFSError(error, { ...context, code, source });
}

/** Decode failures without discarding status or request identifiers. */
export async function readAliyunResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const details = {
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? undefined
  };
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('Expected a JSON object');
      data = parsed as Record<string, unknown>;
    } catch (cause) {
      throw new AliyunDriveError(undefined, 'Invalid JSON response from AliyunDrive', details, {
        cause
      });
    }
  }
  const code = typeof data.code === 'string' && data.code ? data.code : undefined;
  if (!response.ok || code) {
    throw new AliyunDriveError(
      code,
      typeof data.message === 'string'
        ? data.message
        : `Request failed with status ${response.status}`,
      {
        ...details,
        requestId: typeof data.request_id === 'string' ? data.request_id : details.requestId
      }
    );
  }
  return data;
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
