import { describe, it, expect } from 'vitest';

import { BreadFS } from '../src';

describe('breadfs', () => {
  const fs = BreadFS.of({} as any);

  it('path should work', () => {
    expect(fs.path('123').path).toMatchInlineSnapshot('"123"');
    expect(fs.path(fs.path('123'), '456').path).toMatchInlineSnapshot('"123/456"');
  });
});
