import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import configuration, { AppConfig } from './config/configuration';
import { HealthController } from './health/health.controller';
import { Image } from './images/entities/image.entity';
import { ImagesModule } from './images/images.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    // Rate limiting applied globally (OWASP A04) — see ThrottlerGuard below.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl: config.get('throttle.ttl', { infer: true }) * 1000,
            limit: config.get('throttle.limit', { infer: true }),
          },
        ],
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        host: config.get('db.host', { infer: true }),
        port: config.get('db.port', { infer: true }),
        username: config.get('db.username', { infer: true }),
        password: config.get('db.password', { infer: true }),
        database: config.get('db.name', { infer: true }),
        entities: [Image],
        // Schema is owned by migrations; they run automatically on startup.
        // Glob covers both compiled (dist/*.js) and ts-jest (src/*.ts) runs.
        migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
        migrationsRun: true,
        synchronize: config.get('db.synchronize', { infer: true }),
        autoLoadEntities: true,
      }),
    }),

    StorageModule,
    ImagesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
