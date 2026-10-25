/**
 * Stable code for a missing file or directory.
 * Matches Node.js `ENOENT` so existing filesystem errors are recognized
 * without comparing message text.
 */
export const NOT_FOUND_CODE = 'ENOENT' as const;

export type NotFoundCode = typeof NOT_FOUND_CODE;

const DIRECT = Symbol('breadfs.direct-error');

interface DirectInit {
  [DIRECT]: true;
  message: string;
  code?: string;
  cause?: unknown;
}

function directInit(message: string, code: string | undefined, cause: unknown): DirectInit {
  return {
    [DIRECT]: true,
    message,
    code,
    cause
  };
}

function isDirectInit(value: unknown): value is DirectInit {
  return typeof value === 'object' && value !== null && DIRECT in value;
}

function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

function hasHttpNotFoundStatus(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return status === 404;
}

export interface NotFoundErrorOptions {
  /** Path that could not be found, when the provider knows it. */
  path?: string;

  /** Underlying provider or filesystem error. */
  cause?: unknown;
}

/**
 * Error thrown by BreadFS operations.
 *
 * Missing paths are {@link NotFoundError} (`code === "ENOENT"`).
 * Use {@link isNotFound} rather than matching `message` text.
 */
export class BreadFSError extends Error {
  /**
   * Filesystem or provider error code when one is known.
   * Missing paths use {@link NOT_FOUND_CODE}.
   */
  public readonly code?: string;

  public constructor(raw: unknown) {
    if (isDirectInit(raw)) {
      super(raw.message, raw.cause !== undefined ? { cause: raw.cause } : undefined);
      this.name = 'BreadFSError';
      if (raw.code !== undefined) {
        this.code = raw.code;
      }
      return;
    }

    super(raw instanceof Error ? raw.message : 'unknown error');

    if (raw instanceof Error) {
      if (raw.name) {
        this.name = raw.name;
      }
      if (raw.stack) {
        this.stack = raw.stack;
      }
      if (raw.cause) {
        this.cause = raw.cause;
      }
    }

    if (isNotFound(raw)) {
      this.code = NOT_FOUND_CODE;
    } else {
      const code = readErrorCode(raw);
      if (code !== undefined) {
        this.code = code;
      }
    }
  }

  public get raw(): Error | undefined {
    return this.cause instanceof Error ? this.cause : undefined;
  }
}

/**
 * A file or directory does not exist.
 *
 * `BreadFS` operations throw this (it is also a {@link BreadFSError}) when the
 * provider reports a missing path. Other failures stay plain `BreadFSError`s
 * and keep their own `code` when they have one (`EACCES`, provider API codes, …).
 */
export class NotFoundError extends BreadFSError {
  public override readonly code: NotFoundCode = NOT_FOUND_CODE;

  public readonly path?: string;

  public constructor(message?: string, options?: NotFoundErrorOptions) {
    const path = options?.path;
    const resolved = message ?? (path !== undefined ? `${path} not found` : 'path not found');
    super(directInit(resolved, NOT_FOUND_CODE, options?.cause));
    this.name = 'NotFoundError';
    this.path = path;
  }
}

/**
 * True when `error` means the path or directory does not exist.
 *
 * Recognizes {@link NotFoundError}, `code === "ENOENT"` (Node.js, memfs, and
 * errors wrapped by BreadFS), and HTTP status 404 (WebDAV). The check walks
 * `cause`. It does not look at English or Chinese message text.
 *
 * Auth, permission, network, and other provider failures return false.
 */
export function isNotFound(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof NotFoundError) return true;
    if (readErrorCode(current) === NOT_FOUND_CODE) return true;
    if (hasHttpNotFoundStatus(current)) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

function readPath(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if (error instanceof NotFoundError) return error.path;
  const path = (error as { path?: unknown }).path;
  return typeof path === 'string' ? path : undefined;
}

/**
 * Normalize an unknown throw from a provider into {@link NotFoundError}
 * or {@link BreadFSError}. BreadFS operations already do this.
 */
export function toBreadFSError(error: unknown): BreadFSError {
  if (error instanceof NotFoundError) {
    return error;
  }

  if (isNotFound(error)) {
    const message = error instanceof Error ? error.message : 'path not found';
    const wrapped = new NotFoundError(message, {
      path: readPath(error),
      cause: error
    });
    if (error instanceof Error) {
      if (error.name) {
        wrapped.name = error.name;
      }
      if (error.stack) {
        wrapped.stack = error.stack;
      }
    }
    return wrapped;
  }

  if (error instanceof BreadFSError) {
    return error;
  }

  return new BreadFSError(error);
}
