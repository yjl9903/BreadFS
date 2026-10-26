# Error handling

BreadFS operations throw `BreadFSError`. The same contract applies to synchronous
operations and failures while consuming a readable or writable stream. Each provider
constructs its own `BreadFSError`, including when called directly.
BreadFS passes an existing `BreadFSError` through unchanged and wraps any other
thrown value as `ERR_BREADFS_UNKNOWN` with a `core` source.

```ts
import { BreadFSError } from '@breadfs/core';

try {
  await fs.readFile('/documents/report.pdf');
} catch (error) {
  if (!(error instanceof BreadFSError)) throw error;

  if (error.code === 'ENOENT') {
    // The requested file or a parent directory does not exist.
  }

  switch (error.source.provider) {
    case 'node':
      console.error(error.source.syscall, error.source.errno);
      break;
    case 'aliyundrive':
      console.error(error.source.code, error.source.requestId);
      break;
    case 'webdav':
      console.error(error.source.status);
      break;
  }
}
```

## Common fields

| Field | Meaning |
| --- | --- |
| `code` | Public error code used by application logic. |
| `operation` | BreadFS operation, such as `readFile`, `statSync`, or `copy`. |
| `path` | Path string for the failing operation; source path for copy and move. |
| `dest` | Path string for the destination of copy and move. |
| `source` | Discriminated union describing the actual source of the failure. |
| `cause` | Original thrown value, including its existing cause chain. |
| `raw` | Compatibility alias for `cause`, typed as `unknown`. |

`path` and `dest` are strings when present. When an operation receives a BreadFS
`Path`, its `.path` string is used in error context. Errors do not retain a
filesystem wrapper for these fields.

Provider fields are never copied onto the top-level error. `source.provider` narrows
its fields:

| Provider | Additional fields |
| --- | --- |
| `core` | None; errors in BreadFS validation or capability checks. |
| `node` | Original `code`, `syscall`, and `errno`, when available. |
| `mem` | None. |
| `aliyundrive` | Original business `code`, HTTP `status`, and `requestId`, when available. |
| `webdav` | HTTP `status`; optional `condition` with an XML namespace and local name. |

Core declares only `CoreErrorSource` and the extensible `BreadFSErrorSourceMap`.
Each provider package owns and exports its source interface, and augments the
registry when its types are imported. For example, import `NodeErrorSource` from
`@breadfs/node`, not `@breadfs/core`. The `breadfs/node`, `breadfs/mem`,
`breadfs/aliyundrive`, and `breadfs/webdav` entry points re-export their provider's
types. Importing only core does not load any provider registrations.

The WebDAV adapter currently exposes HTTP status from its client library. It does
not infer DAV conditions from error messages; `condition` is reserved for structured
protocol details when available. No numeric errno is fabricated for remote errors.

For a cross-provider copy, a provider failure retains the actual failing operation
(such as `writeFile` or `createWriteStream`) and its path. BreadFS does not replace
its context, add another error wrapper, or change its object identity. A provider
may set context for its own compound operations, such as a native `copy` or `move`.
Core checks, such as rejecting an unsupported file type, use `source.provider === 'core'`.

## Public codes

Known local path conditions use filesystem codes such as `ENOENT`, `EEXIST`,
`ENOTDIR`, `EISDIR`, and `ENOTSUP`. Node and memfs retain their original codes,
including Node-specific `ERR_FS_*` and argument errors. Code is a string rather
than a closed enum: the native API and third-party providers can add codes.

Remote failures use these additional codes:

| Code | Meaning |
| --- | --- |
| `ERR_BREADFS_AUTH` | Authentication failed, including after the one allowed token refresh. |
| `ERR_BREADFS_RATE_LIMITED` | The server returned HTTP 429. |
| `ERR_BREADFS_REMOTE` | A remote response failed without a more specific supported mapping. |
| `ERR_BREADFS_UNKNOWN` | The failure could not be classified. |

Known transport failures retain codes such as `ECONNRESET`, `ECONNREFUSED`,
`ENOTFOUND`, and `ETIMEDOUT`; cancellation is represented as `ABORT_ERR`.
`ENOTFOUND` is a DNS failure, not a missing file.

WebDAV maps HTTP 401 to `ERR_BREADFS_AUTH`, 403 to `EACCES`, 404 to `ENOENT`,
423 to `EBUSY`, and 507 to `ENOSPC`. For MKCOL specifically, 409 maps to `ENOENT`
and 405 to `EEXIST`. COPY/MOVE 412 maps to `EEXIST` only when the adapter requested
no overwrite; other 409/412 failures remain `ERR_BREADFS_REMOTE`.

AliyunDrive preserves service business codes separately from public codes. Known
access-token errors map to `ERR_BREADFS_AUTH`; HTTP 401, 403, 429, and 507 also have
specific mappings. Other business failures remain `ERR_BREADFS_REMOTE` until their
semantics are established. An OpenAPI endpoint returning 404 is not assumed to mean
a missing file. Local path resolution supplies `ENOENT` and type errors directly.

## Custom providers

Catch backend failures inside provider methods and throw a `BreadFSError` directly.
Stream failures must also be converted inside the provider, including errors that
arrive after stream creation. No error conversion hook is part of `BreadFSProvider`.
BreadFS only wraps unclassified errors as `ERR_BREADFS_UNKNOWN`; it does not inspect
backend codes or call provider-specific error converters.

Extend the source registry rather than adding a broad `provider: string` union member:

```ts
import { BreadFSError } from '@breadfs/core';

declare module '@breadfs/core' {
  interface BreadFSErrorSourceMap {
    example: { provider: 'example'; traceId?: string };
  }
}

async function readFile(path: string): Promise<Uint8Array> {
  try {
    return await backend.readFile(path);
  } catch (error) {
    if (error instanceof BreadFSError) throw error;
    throw new BreadFSError(error, {
      code: 'ERR_BREADFS_UNKNOWN',
      operation: 'readFile',
      path,
      source: { provider: 'example' }
    });
  }
}
```

## Migration notes

- `path` and `dest` are optional strings. Pass `value.path` if constructing an
  error from a BreadFS `Path`.
- Construct errors with `new BreadFSError(raw, { code, operation, source, ... })`.
  The context argument is now required.
- The error name is consistently `BreadFSError`; the original name and stack are
  available through `cause`, instead of replacing the wrapper's name and stack.
- `raw` now returns the original thrown value, not the original error's cause.
- `exists()` returns `false` only for missing entries. Permission, authentication,
  network, and non-directory path-component errors propagate. This also applies
  to Node and memfs providers, and the synchronous variants.
- `remove({ force: true })` only ignores missing entries. In particular, WebDAV
  deletion failures such as HTTP 403 or 500 are no longer silently ignored.
- WebDAV write-stream `close()` waits for the server's upload acknowledgement, so
  a late HTTP failure rejects the close operation.
- Failed destination metadata checks in copy/move propagate unless the destination
  is missing. They no longer allow an attempted write after an authorization error.
