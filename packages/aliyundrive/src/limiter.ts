import { sleep } from './utils';
import { linkRateLimit, listRateLimit, otherRateLimit } from './constants';

export enum LimiterType {
  List = 'list',
  Link = 'link',
  Other = 'other'
}

class SimpleLimiter {
  private last = 0;
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly minIntervalMs: number) {}

  public async wait(): Promise<void> {
    let release: () => void;
    const prev = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    const now = Date.now();
    const waitMs = Math.max(0, this.last + this.minIntervalMs - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    this.last = Date.now();
    release!();
  }
}

export class AliyunLimiter {
  public usedBy = 0;
  public readonly list = new SimpleLimiter(1000 / listRateLimit);
  public readonly link = new SimpleLimiter(1000 / linkRateLimit);
  public readonly other = new SimpleLimiter(1000 / otherRateLimit);

  public wait(type: LimiterType): Promise<void> {
    switch (type) {
      case LimiterType.List:
        return this.list.wait();
      case LimiterType.Link:
        return this.link.wait();
      default:
        return this.other.wait();
    }
  }
}

const limiters = new Map<string, AliyunLimiter>();

export const getLimiterForUser = (userId: string): AliyunLimiter => {
  const existing = limiters.get(userId);
  if (existing) {
    existing.usedBy += 1;
    return existing;
  }
  const limiter = new AliyunLimiter();
  limiter.usedBy = 1;
  limiters.set(userId, limiter);
  return limiter;
};
