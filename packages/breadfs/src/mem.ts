import { BreadFS } from '@breadfs/core';
import { MemProvider, type MemProviderOptions } from '@breadfs/mem';

export * from '@breadfs/core';

export * from '@breadfs/mem';

export class MemFS extends BreadFS<MemProvider> {
  public constructor(options: MemProviderOptions = {}) {
    super(new MemProvider(options));
  }

  public static make(options: MemProviderOptions = {}) {
    return new MemFS(options);
  }
}
