/**
 * Storage abstraction.
 *
 * The rest of the app depends only on this contract, never on a concrete
 * backend. Swapping local filesystem for S3/Azure/GCS later means adding a
 * single new implementation and rebinding the provider — no changes to the
 * image business logic. (See README → Scalability.)
 */
export abstract class StorageService {
  /**
   * Persist a binary payload under `key` and return the stored key.
   * @param key   storage-relative identifier (e.g. "a1b2c3.webp")
   * @param data  file contents
   */
  abstract save(key: string, data: Buffer): Promise<string>;

  /** Read a stored object back into memory. */
  abstract read(key: string): Promise<Buffer>;

  /** Whether an object exists for `key`. */
  abstract exists(key: string): Promise<boolean>;

  /** Remove an object (best-effort; used for cleanup on failures). */
  abstract delete(key: string): Promise<void>;
}
