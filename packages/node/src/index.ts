import { inspect } from 'node:util';

import { Path } from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  // @ts-ignore
  return this.path;
};

export { BreadFS } from '@breadfs/core';
