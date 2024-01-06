import { BreadFS } from '@breadfs/core';
import { WebDAVProvider, WebDAVClientOptions } from '@breadfs/webdav';

export * from '@breadfs/core';

export * from '@breadfs/webdav';

export class WebDAVFS extends BreadFS<WebDAVProvider> {
  public constructor(remoteURL: string, options: WebDAVClientOptions = {}) {
    super(new WebDAVProvider(remoteURL, options));
  }

  public static make(remoteURL: string, options: WebDAVClientOptions = {}) {
    return new WebDAVFS(remoteURL, options);
  }
}
