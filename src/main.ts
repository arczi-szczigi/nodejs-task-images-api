import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security headers (OWASP A05). crossOriginResourcePolicy relaxed so the
  // served images can be embedded cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Validate + transform all incoming payloads. Unknown fields are rejected.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Consistent, traceable error responses across the whole API.
  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI v3 / Swagger UI at /api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Images API')
    .setDescription(
      'REST API for uploading and serving images. ' +
        'Upload an image, optionally resized, and fetch it back by id.',
    )
    .setVersion('1.0')
    .addTag('images')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API ready on http://localhost:${port}  •  docs at /api`);
}

void bootstrap();
