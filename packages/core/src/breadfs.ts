import pathe from 'pathe';

export class BreadFS {
  public constructor() {}

  public static of() {
    return new BreadFS();
  }

  public path(path: string): Path {
    return new Path(this, path);
  }
}

export class Path {
  private readonly fs: BreadFS;

  private readonly path: string;

  public constructor(fs: BreadFS, path: string) {
    this.fs = fs;
    this.path = path;
  }

  public get basename() {
    return pathe.basename(this.path);
  }

  public get dirname() {
    return pathe.dirname(this.path);
  }

  public join(...pieces: string[]) {
    return new Path(this.fs, pathe.join(this.path, ...pieces));
  }

  public resolve(...pieces: string[]) {
    return new Path(this.fs, pathe.resolve(this.path, ...pieces));
  }

  public toString() {
    return this.path;
  }
}
