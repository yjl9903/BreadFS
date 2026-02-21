export class BreadFSError extends Error {
  public constructor(raw: unknown) {
    super(raw instanceof Error ? raw.message : 'unknown error', {
      cause: raw instanceof Error ? raw.cause : raw
    });
  }

  public get raw(): Error | undefined {
    return this.cause as Error | undefined;
  }
}
