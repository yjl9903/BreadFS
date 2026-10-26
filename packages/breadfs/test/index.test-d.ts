import { describe, it, expectTypeOf } from 'vitest';

import type {
  BreadFSErrorSource,
  BreadFSErrorSourceMap,
  BreadFSError,
  BreadFSErrorContext
} from '@breadfs/core';
import type { NodeErrorSource } from '@breadfs/node';
import type { MemErrorSource } from '@breadfs/mem';
import type { WebDAVErrorSource } from '@breadfs/webdav';
import type { AliyunDriveErrorSource } from '@breadfs/aliyundrive';

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

describe('provider error registrations', () => {
  it('registers the types exported by each provider', () => {
    expectTypeOf<BreadFSErrorSourceMap['node']>().toEqualTypeOf<NodeErrorSource>();
    expectTypeOf<BreadFSErrorSourceMap['mem']>().toEqualTypeOf<MemErrorSource>();
    expectTypeOf<BreadFSErrorSourceMap['aliyundrive']>().toEqualTypeOf<AliyunDriveErrorSource>();
    expectTypeOf<BreadFSErrorSourceMap['webdav']>().toEqualTypeOf<WebDAVErrorSource>();
  });

  it('narrows provider-specific fields by source.provider', () => {
    function check(source: BreadFSErrorSource) {
      if (source.provider === 'node') {
        expectTypeOf(source.errno).toEqualTypeOf<number | undefined>();
        // @ts-expect-error HTTP fields are not part of Node errors.
        source.status;
      } else if (source.provider === 'aliyundrive') {
        expectTypeOf(source.requestId).toEqualTypeOf<string | undefined>();
        // @ts-expect-error Native fields are not part of AliyunDrive errors.
        source.syscall;
      } else if (source.provider === 'webdav') {
        expectTypeOf(source.status).toEqualTypeOf<number | undefined>();
        // @ts-expect-error AliyunDrive request identifiers are not shared WebDAV fields.
        source.requestId;
      }
    }
    check({ provider: 'node' });
  });
});

describe('error paths', () => {
  it('exposes only string values', () => {
    expectTypeOf<BreadFSError['path']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<BreadFSError['dest']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<BreadFSErrorContext['path']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<BreadFSErrorContext['dest']>().toEqualTypeOf<string | undefined>();
  });
});
