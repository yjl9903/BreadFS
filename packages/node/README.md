# @breadfs/node

[![version](https://img.shields.io/npm/v/@breadfs/node?label=@breadfs/node)](https://www.npmjs.com/package/@breadfs/node)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/node
```

## Usage

```ts
import { BreadFS, NodeFS } from 'breadfs/node'

const nfs = BreadFS.of(NodeFS)

await nfs.path('/test.txt').readText()
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
