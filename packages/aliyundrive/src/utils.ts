import { posix as path } from 'node:path';

import type { FileItem } from './types';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const normalizePath = (input: string): string => {
  if (!input) return '/';
  let normalized = path.normalize(input.replace(/\\/g, '/'));
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

export const concatChunks = (chunks: Uint8Array[], totalLength: number) => {
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
};

export const getItemName = (item: Pick<FileItem, 'name' | 'file_name'>): string =>
  item.name ?? item.file_name ?? '';

export const toNumber = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getPartSize = (fileSize: number): number => {
  let partSize = 20 * 1024 * 1024;
  if (fileSize > partSize) {
    const GB = 1024 * 1024 * 1024;
    const TB = 1024 * GB;
    if (fileSize > 1 * TB) {
      partSize = 5 * GB;
    } else if (fileSize > 768 * GB) {
      partSize = 109_951_163;
    } else if (fileSize > 512 * GB) {
      partSize = 82_463_373;
    } else if (fileSize > 384 * GB) {
      partSize = 54_975_582;
    } else if (fileSize > 256 * GB) {
      partSize = 41_231_687;
    } else if (fileSize > 128 * GB) {
      partSize = 27_487_791;
    }
  }
  return partSize;
};

export const makePartInfoList = (size: number): { part_number: number }[] =>
  Array.from({ length: size }, (_, index) => ({ part_number: index + 1 }));
