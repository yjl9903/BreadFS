export class BreadFSError extends Error {
  public constructor(raw: unknown) {
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
  }

  public get raw(): Error | undefined {
    return this.cause as Error | undefined;
  }
}
