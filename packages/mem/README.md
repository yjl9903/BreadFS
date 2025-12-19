# @breadfs/mem

[![version](https://img.shields.io/npm/v/@breadfs/mem?label=@breadfs/mem)](https://www.npmjs.com/package/@breadfs/mem)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/mem
```

## Usage

```ts
import { MemFS } from '@breadfs/mem'
import { BreadFS } from '@breadfs/core'

const fs = BreadFS.of(MemFS)

await fs.path('/example.txt').writeText('hello')
await fs.path('/example.txt').readText()
```

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
