# @breadfs/webdav

[![version](https://img.shields.io/npm/v/@breadfs/webdav?label=@breadfs/webdav)](https://www.npmjs.com/package/@breadfs/webdav)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/webdav
```

## Usage

```ts
import { BreadFS, WebDAVProvider, AuthType } from 'breadfs/webdav';

const nfs = BreadFS.of(WebDAVProvider.of("https://some-server.org", {
    authType: AuthType.Digest,
    username: "user",
    password: "pass"
}));

const test = nfs.path('/test');
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
