import { inspect } from 'node:util';

import { Path } from '@breadfs/core';

// @ts-ignore
Path.prototype[inspect.custom] = function () {
  return this.toString();
};

export { BreadFS } from '@breadfs/core';
