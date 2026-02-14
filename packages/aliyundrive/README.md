# @breadfs/aliyundrive

[![version](https://img.shields.io/npm/v/@breadfs/aliyundrive?label=@breadfs/aliyundrive)](https://www.npmjs.com/package/@breadfs/aliyundrive)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/aliyundrive
```

## Usage

```ts
import { WebDAVFS } from 'breadfs/aliyundrive'

const wfs = WebDAVFS.make("https://some-server.org", {
    username: "user",
    password: "pass"
})

await wfs.path('/test.txt').readText()
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
