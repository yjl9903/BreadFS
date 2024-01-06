import { describe, it, expect, expectTypeOf } from 'vitest';

import { fs } from 'breadfs/node';

describe('breadfs path', () => {
  it('should work', () => {
    expectTypeOf(fs.path('123').fs.name).toMatchTypeOf<string>();
  });
});
