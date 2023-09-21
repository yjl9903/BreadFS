# @breadfs/webdav

[![version](https://img.shields.io/npm/v/@breadfs/webdav?label=@breadfs/webdav)](https://www.npmjs.com/package/@breadfs/webdav)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/webdav
```

## Usage

```ts
import { WebDAVFS } from 'breadfs/webdav'

const wfs = WebDAVFS.make("https://some-server.org", {
    username: "user",
    password: "pass"
})

await wfs.path('/test.txt').readText()
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
