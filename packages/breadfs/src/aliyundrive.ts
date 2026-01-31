import { BreadFS } from '@breadfs/core';
import { AliyunDriveProvider, AliyunDriveProviderOptions } from '@breadfs/aliyundrive';

export * from '@breadfs/core';

export * from '@breadfs/aliyundrive';

export class AliyundriveFS extends BreadFS<AliyunDriveProvider> {
  public constructor(options: AliyunDriveProviderOptions) {
    super(new AliyunDriveProvider(options));
  }

  public static make(options: AliyunDriveProviderOptions) {
    return new AliyundriveFS(options);
  }
}
