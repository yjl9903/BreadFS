export interface CoreErrorSource {
  provider: 'core';
}

/** Providers extend this registry through module augmentation. */
export interface BreadFSErrorSourceMap {
  core: CoreErrorSource;
}

export type BreadFSErrorSource = BreadFSErrorSourceMap[keyof BreadFSErrorSourceMap];

export interface BreadFSErrorContext {
  operation: string;
  path?: string;
  dest?: string;
}

export interface BreadFSErrorOptions extends BreadFSErrorContext {
  code: string;
  source: BreadFSErrorSource;
}

export class BreadFSError extends Error {
  public readonly code: string;
  public readonly operation: string;
  public readonly path?: string;
  public readonly dest?: string;
  public readonly source: BreadFSErrorSource;

  public constructor(raw: unknown, options: BreadFSErrorOptions) {
    super(raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : 'Unknown error', {
      cause: raw
    });
    this.name = 'BreadFSError';
    this.code = options.code;
    this.operation = options.operation;
    this.path = options.path;
    this.dest = options.dest;
    this.source = options.source;
  }

  /** Original thrown value. Kept as an alias for existing callers. */
  public get raw(): unknown {
    return this.cause;
  }

  /** Add outer operation context without losing the actual failure source. */
  public withContext(context: BreadFSErrorContext): BreadFSError {
    if (
      this.operation === context.operation &&
      this.path === context.path &&
      this.dest === context.dest
    )
      return this;
    return new BreadFSError(this, { ...context, code: this.code, source: this.source });
  }
}
