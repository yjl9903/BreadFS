export class BreadFSError extends Error {
  private readonly _raw: unknown;

  public constructor(raw: unknown) {
    super(raw instanceof Error ? raw.message : 'unknown error');
    this._raw = raw;
  }

  public get raw(): Error | undefined {
    return this._raw instanceof Error ? this._raw : undefined;
  }
}
