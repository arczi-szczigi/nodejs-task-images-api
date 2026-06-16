import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import configuration from './config/configuration';
import { Image } from './images/entities/image.entity';

loadEnv();
const cfg = configuration();

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The runtime app builds its own DataSource from ConfigService in AppModule;
 * this one mirrors the same env so the schema source of truth is shared.
 */
export default new DataSource({
  type: 'postgres',
  host: cfg.db.host,
  port: cfg.db.port,
  username: cfg.db.username,
  password: cfg.db.password,
  database: cfg.db.name,
  entities: [Image],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
