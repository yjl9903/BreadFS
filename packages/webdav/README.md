# @breadfs/webdav

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
