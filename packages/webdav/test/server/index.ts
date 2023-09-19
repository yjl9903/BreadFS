import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { v2 as ws } from 'webdav-server';

import { PASSWORD, PORT, USERNAME } from './credentials';

export * from './credentials';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(dir: string, authType: 'basic' | 'digest') {
  if (!dir) {
    throw new Error('Expected target directory');
  }

  const userManager = new ws.SimpleUserManager();
  const user = userManager.addUser(USERNAME, PASSWORD);
  let auth;
  switch (authType) {
    case 'digest':
      auth = new ws.HTTPDigestAuthentication(userManager, 'test');
      break;
    case 'basic':
    /* falls-through */
    default:
      auth = new ws.HTTPBasicAuthentication(userManager);
      break;
  }

  const privilegeManager = new ws.SimplePathPrivilegeManager();
  privilegeManager.setRights(user, '/', ['all']);

  const server = new ws.WebDAVServer({
    port: PORT,
    httpAuthentication: auth,
    privilegeManager: privilegeManager,
    maxRequestDepth: Infinity,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':
        'HEAD, GET, PUT, PROPFIND, DELETE, OPTIONS, MKCOL, MOVE, COPY',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, Content-Length, Depth'
    }
  });

  // console.log(`Created WebDAV server on http://localhost:${PORT}/dav`);

  return {
    start() {
      return new Promise(function (resolve) {
        server.setFileSystem('/dav', new ws.PhysicalFileSystem(dir), function () {
          server.start(resolve);
        });
      });
    },

    stop() {
      return new Promise<void>(function (resolve) {
        server.stop(resolve);
      });
    }
  };
}

export function createWebDAVServer(authType: 'basic' | 'digest' = 'digest') {
  return createServer(path.resolve(dirname, '../fixtures'), authType);
}
