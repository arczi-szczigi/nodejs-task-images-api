/**
 * Centralised, typed configuration loaded from environment variables.
 * Keeping it in one place makes the app's tunables explicit and testable.
 */
export interface AppConfig {
  port: number;
  publicBaseUrl: string;
  storageDir: string;
  maxFileSize: number;
  maxImageDimension: number;
  throttle: { ttl: number; limit: number };
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default (): AppConfig => ({
  port: toInt(process.env.PORT, 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
  storageDir: process.env.STORAGE_DIR ?? './storage',
  maxFileSize: toInt(process.env.MAX_FILE_SIZE, 5 * 1024 * 1024),
  maxImageDimension: toInt(process.env.MAX_IMAGE_DIMENSION, 4000),
  throttle: {
    ttl: toInt(process.env.THROTTLE_TTL, 60),
    limit: toInt(process.env.THROTTLE_LIMIT, 60),
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'images',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
  },
});
