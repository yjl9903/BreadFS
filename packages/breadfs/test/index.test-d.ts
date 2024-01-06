import { describe, it, expectTypeOf } from 'vitest';

import { fs } from '../src/node';
import { WebDAVFS } from '../src/webdav';

describe('breadfs path', () => {
  it('should work', () => {
    const webdav = new WebDAVFS(`123`);
    const nodep = fs.path('123');
    const webdavp = webdav.path('123');
    expectTypeOf(nodep.fs.name).toMatchTypeOf<string>();
    expectTypeOf(webdav.path(nodep).fs.name).toMatchTypeOf<string>();
    expectTypeOf(fs.path(webdavp).fs.name).toMatchTypeOf<string>();
    expectTypeOf(webdavp.fs.name).toMatchTypeOf<string>();
  });
});
