import { BreadFSError } from './error';

/** Use only where a missing entry is explicitly allowed. */
export function ignoreNotFound(error: unknown): undefined {
  if (!(error instanceof BreadFSError) || error.code !== 'ENOENT') throw error;
  return undefined;
}
