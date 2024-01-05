# BreadFS

[![version](https://img.shields.io/npm/v/breadfs?label=breadfs)](https://www.npmjs.com/package/breadfs)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

Unified File System Abstraction.

+ Frequently used **file system operation API**
+ **Operate files cross across different file systems**
+ [Node.js fs module](https://nodejs.org/api/fs.html) provider
+ [WebDAV client](https://github.com/perry-mitchell/webdav-client) provider

```ts
import { fs as nfs } from 'breadfs/node'
import { WebDAVFS } from 'breadfs/webdav'

// Write something to hello.txt
const local = nfs.path('hello.txt')
await local.writeText('This is used for testing')

// Create WebDAV file system
const wfs = WebDAVFS.make("https://some-server.org", {
    username: "user",
  password: "pass"
})

// Copy the local hello.txt to the remote WebDAV server
const remote = wfs.path('/hello.txt')
await local.copyTo(remote)
await remote.readText()
// Return 'This is used for testing'
```

## Installation

```bash
npm i breadfs
```

> **Notice**
>
> This package is built on the web native [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). You should add `"lib": ["ES2018", "DOM"]` to your `tsconfig.json`.

## Usage

### Node

```ts
import { fs as nfs } from 'breadfs/node'

const bin = nfs.path('/bin')

await bin.list()
await bin.join('node').stat()
await nfs.path('/home/.bashrc').readFile()
await nfs.path('/home/.bashrc').readText()
await nfs.path('/home/test.txt').writeText('This is used for testing')
```

### WebDAV

```ts
import { WebDAVFS } from 'breadfs/webdav'

const wfs = WebDAVFS.make("https://some-server.org", {
  username: "user",
  password: "pass"
})

await wfs.path('/test.txt').readText()
```

### Across different file systems

```ts
import { fs as nfs } from 'breadfs/node'
import { WebDAVFS } from 'breadfs/webdav'

const wfs = WebDAVFS.make("https://some-server.org", {
  username: "user",
  password: "pass"
})

const local = nfs.path('hello.txt')
const remote = wfs.path('/hello.txt')
await local.writeText('This is used for testing')
await local.copyTo(remote)
await remote.readText()  // 'This is used for testing'
```

Operating files across various different file systems can be quite **challenging**, which means our implementation may **not function perfectly in all scenarios**. Even file system in your local machine may encounter some bugs.

So that the goal of this package is to provide **a straightforward abstraction and utility** for use in **less complex or basic situations**.

## Related

This package is used to power [AnimeSpace](https://github.com/yjl9903/AnimeSpace), offering a comprehensive solution for automatically following bangumis. It can fetch anime resources, download desired video content, and upload them to the local file system or remote WebDAV server. The upload process is facilitated by this package.

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
