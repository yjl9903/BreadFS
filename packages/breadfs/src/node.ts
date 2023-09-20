import { NodeFS } from '@breadfs/node';
import { BreadFS } from '@breadfs/core';

export const fs = BreadFS.of(NodeFS);

export * from '@breadfs/core';

export * from '@breadfs/node';
