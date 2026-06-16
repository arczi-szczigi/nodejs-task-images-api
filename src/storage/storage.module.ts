import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';

/**
 * Binds the StorageService contract to its concrete implementation.
 * To switch backends, replace `LocalStorageService` here (e.g. with an
 * `S3StorageService`) — nothing else in the app needs to change.
 */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: LocalStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
