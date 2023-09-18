# BreadFS

[![version](https://img.shields.io/npm/v/breadfs?label=breadfs)](https://www.npmjs.com/package/breadfs)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

Unified File System abstraction.

## Installation

```bash
npm i breadfs
```

> **Notice**
>
> This package is built on the web native [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). You should add `"lib": ["DOM"]` to your `tsconfig.json`.

## Usage

```ts
import { BreadFS, NodeFS } from 'breadfs/node';

const nfs = BreadFS.of(NodeFS);

const bin = nfs.path('/bin');
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
