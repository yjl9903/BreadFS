# BreadFS

[![version](https://img.shields.io/npm/v/breadfs?label=breadfs)](https://www.npmjs.com/package/breadfs)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

Unified File System Abstraction.

+ File System operation API
+ [Node.js fs module](https://nodejs.org/api/fs.html) wrapper
+ [WebDAV client](https://github.com/perry-mitchell/webdav-client) wrapper

> 👷‍♂️ Still work in progress.

## Installation

```bash
npm i breadfs
```

> **Notice**
>
> This package is built on the web native [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). You should add `"lib": ["ES2018", "DOM"]` to your `tsconfig.json`.

## Usage

```ts
import { fs as nfs } from 'breadfs/node'

const bin = nfs.path('/bin')

await bin.list()
await bin.join('node').stat()
await nfs.path('/home/.bashrc').readFile()
await nfs.path('/home/.bashrc').readText()
await nfs.path('/home/test.txt').writeText('This is used for testing')
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
