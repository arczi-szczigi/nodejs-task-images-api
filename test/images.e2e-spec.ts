import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * End-to-end tests exercising the real HTTP stack against a PostgreSQL
 * database. Start a DB first:  `docker compose up -d db`  then  `npm run test:e2e`.
 *
 * The suite mirrors main.ts so behaviour under test matches production.
 */
describe('Images API (e2e)', () => {
  let app: INestApplication;

  const makePng = (w = 320, h = 240): Promise<Buffer> =>
    sharp({ create: { width: w, height: h, channels: 3, background: '#3478f6' } })
      .png()
      .toBuffer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /images', () => {
    it('uploads and resizes an image (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/images')
        .field('title', 'E2E sunset')
        .field('width', '160')
        .field('height', '160')
        .attach('file', await makePng(800, 400), 'sunset.png')
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'E2E sunset',
        width: 160,
        height: 80, // aspect ratio preserved (800x400 → fit 160)
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.url).toContain(`/images/${res.body.id}/raw`);

      // the url actually serves an image
      await request(app.getHttpServer())
        .get(`/images/${res.body.id}/raw`)
        .expect(200)
        .expect('Content-Type', /image\//);
    });

    it('rejects a non-image file (422)', async () => {
      const res = await request(app.getHttpServer())
        .post('/images')
        .field('title', 'evil')
        .attach('file', Buffer.from('<?php echo 1; ?>'), 'evil.png')
        .expect(422);

      expect(res.body.traceId).toBeDefined();
      expect(res.body.statusCode).toBe(422);
    });

    it('rejects missing title (400) with a field-level message', async () => {
      const res = await request(app.getHttpServer())
        .post('/images')
        .attach('file', await makePng(), 'x.png')
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('title');
    });

    it('rejects an out-of-range width (400)', async () => {
      await request(app.getHttpServer())
        .post('/images')
        .field('title', 'too big')
        .field('width', '999999')
        .attach('file', await makePng(), 'x.png')
        .expect(400);
    });
  });

  describe('GET /images', () => {
    it('lists images with pagination metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/images?page=1&limit=5')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters by title (contains)', async () => {
      const unique = `zzz-${Date.now()}`;
      await request(app.getHttpServer())
        .post('/images')
        .field('title', `tagged ${unique}`)
        .attach('file', await makePng(), 'f.png')
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/images?title=${unique}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data[0].title).toContain(unique);
    });
  });

  describe('GET /images/:id', () => {
    it('returns a single image', async () => {
      const created = await request(app.getHttpServer())
        .post('/images')
        .field('title', 'single')
        .attach('file', await makePng(), 's.png')
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/images/${created.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.title).toBe('single');
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app.getHttpServer())
        .get('/images/3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34')
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.traceId).toBeDefined();
    });

    it('returns 400 for a malformed (non-uuid) id', async () => {
      await request(app.getHttpServer()).get('/images/not-a-uuid').expect(400);
    });
  });
});
