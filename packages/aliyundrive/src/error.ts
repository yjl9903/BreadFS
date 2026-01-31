export class AliyunDriveError extends Error {
  public readonly code?: string;

  public constructor(code?: string, message?: string) {
    super(code ? `${code}:${message ?? ''}` : (message ?? 'AliyunDrive error'));
    this.code = code;
  }
}
