# @breadfs/aliyundrive

[![version](https://img.shields.io/npm/v/@breadfs/aliyundrive?label=@breadfs/aliyundrive)](https://www.npmjs.com/package/@breadfs/aliyundrive)
[![CI](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/breadfs/actions/workflows/ci.yml)

## Installation

```bash
npm i breadfs @breadfs/aliyundrive
```

## Usage

> You can follow this [OpenList docs](https://doc.oplist.org.cn/guide/drivers/aliyundrive_open) and [OpenList Token 获取工具](https://api.oplist.org/) to get the aliyundrive refresh token.

```ts
import { AliyundriveFS } from 'breadfs/aliyundrive'

const fs = new AliyundriveFS({
  refresh: {
    token: process.env.ALIYUNDRIVE_REFRESH_TOKEN!,
    endpoint: 'https://api.oplist.org/alicloud/renewapi'
  }
})

const resp = await fs.list('/anime/');
console.log(resp)
```

## Credits

Thanks to [OpenList](https://github.com/OpenListTeam/OpenList) (previous [AList](https://github.com/AlistGo/alist)) for the original implementation and refresh token service.

## License

MIT License © 2023 [XLor](https://github.com/yjl9903)
