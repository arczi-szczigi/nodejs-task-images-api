# Images API

A REST API for uploading and serving images, built for the **FutureMind NodeJS recruitment task**.

Upload an image (optionally resized), store it, and fetch it back by id — with title
filtering, pagination, OpenAPI docs, and a security-first implementation.

**Stack:** NestJS 11 · PostgreSQL · TypeORM · sharp · Multer · Swagger · Jest · Docker Compose

---

## Quick start

The whole stack (API + PostgreSQL) runs with a single command:

```bash
cp .env.example .env        # optional — sensible defaults are baked in
docker compose up --build
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api>
- Health: <http://localhost:3000/health>

> The Dockerised DB is exposed on host port **5433** (not 5432) to avoid clashing
> with a locally-installed PostgreSQL. Inside the compose network the API still
> talks to `db:5432`.

### Local development (hot reload)

Run only the database in Docker and the API on your host:

```bash
npm install
docker compose up -d db
npm run start:dev
```

---

## API

Base path: `/images`

| Method | Path               | Description                                        |
| ------ | ------------------ | -------------------------------------------------- |
| POST   | `/images`          | Upload an image (multipart), optionally resized    |
| GET    | `/images`          | List images — filter by `title`, paginated         |
| GET    | `/images/:id`      | Get a single image's metadata                      |
| GET    | `/images/:id/raw`  | Fetch the image binary (this is the returned `url`)|

Full, example-rich documentation lives in **Swagger** at `/api`.

### Upload — `POST /images`

`multipart/form-data`:

| Field    | Type    | Required | Notes                                       |
| -------- | ------- | -------- | ------------------------------------------- |
| `file`   | file    | yes      | Image. Validated by **magic bytes**.        |
| `title`  | string  | yes      | 1–255 chars.                                |
| `width`  | integer | no       | 1–4000. Scales to fit (aspect preserved).   |
| `height` | integer | no       | 1–4000. Scales to fit (aspect preserved).   |

```bash
curl -F "title=Sunset over the mountains" \
     -F "width=800" -F "height=600" \
     -F "file=@./sunset.jpg" \
     http://localhost:3000/images
```

```json
{
  "id": "3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34",
  "url": "http://localhost:3000/images/3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34/raw",
  "title": "Sunset over the mountains",
  "width": 800,
  "height": 533
}
```

### List — `GET /images`

```bash
curl "http://localhost:3000/images?title=sunset&page=1&limit=20"
```

```json
{
  "data": [ { "id": "…", "url": "…", "title": "…", "width": 800, "height": 533 } ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Errors

Every error returns a consistent, debuggable envelope (see *Error handling* below):

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Unsupported or invalid image. Detected content type: application/x-msdownload. Allowed: image/jpeg, image/png, ...",
  "path": "/images",
  "method": "POST",
  "timestamp": "2026-06-16T20:00:00.000Z",
  "traceId": "a1b2c3d4-…"
}
```

---

## Image processing

- Uploaded files are **re-encoded to WebP** with `sharp`.
- Resizing uses `fit: inside` with `withoutEnlargement` — images are **scaled**
  to fit the requested box, aspect ratio preserved, never upscaled.
- EXIF orientation is applied, then metadata is dropped during re-encode.

---

## Security (OWASP Top 10)

Security was a design goal, not an afterthought. What's addressed:

| Risk | Mitigation |
| ---- | ---------- |
| **A03 Injection** | TypeORM parameterised queries only; all input validated via `class-validator` DTOs; unknown fields rejected (`whitelist` + `forbidNonWhitelisted`). |
| **A05 Misconfiguration** | File type validated by **magic bytes** (`file-type`), never by extension/`Content-Type`; `helmet` security headers; served files carry `X-Content-Type-Options: nosniff`; storage filenames are app-generated UUIDs (path-traversal-proof, with an explicit guard in `LocalStorageService`). |
| **A04 Insecure Design** | Upload size capped (`MAX_FILE_SIZE`); resize dimensions capped (`MAX_IMAGE_DIMENSION`) to prevent image-bomb / OOM; global **rate limiting** (`@nestjs/throttler`). |
| **A08 Integrity** | Images are fully re-encoded, neutralising malicious/oversized embedded metadata. |
| **A09 Logging** | Centralised exception logging with a `traceId`; internal errors never leak to clients. |
| **A01 Access Control** | Out of scope per the task (no auth). In production, write/list endpoints would sit behind authentication (JWT/API key) — see *Future work*. |

**Not implemented (deliberately out of scope, listed as next steps):** antivirus
scanning of uploads (e.g. ClamAV), authentication/authorization, at-rest encryption.

---

## Error handling

A global `AllExceptionsFilter` produces one consistent error shape across the API.
Each response includes:

- the **field-level reason** for validation failures (from `class-validator`),
- the failing `path` + `method`,
- a **`traceId`** that is also written to the server logs — so any reported error
  can be located instantly.

Unexpected (non-HTTP) errors are logged with their full stack but only return a
generic message + `traceId` to the caller.

---

## Scalability

Decisions taken now to keep the design horizontally scalable, and what comes next:

**In the code today**

- **Storage abstraction** — the app depends on a `StorageService` contract, not
  on the filesystem. Swapping to S3/Azure/GCS is a single new implementation
  (`storage.module.ts`), no business-logic changes. This is also what makes the
  API truly stateless.
- **Stateless API** — no in-process state, so it scales horizontally behind a
  load balancer.
- **Indexed queries** — `title` is indexed for the list filter.
- **Pagination** — built in from the start.

**Next steps (documented, not built)**

```
                 ┌─────────────┐     ┌──────────────────┐
   Client ─────► │  API (×N)   │ ──► │  PostgreSQL       │
                 │  stateless  │     │  (+ read replicas)│
                 └──────┬──────┘     └──────────────────┘
                        │
                        ▼
                 ┌─────────────┐   (future)  ┌──────────┐   ┌─────┐
                 │   Storage   │ ──────────► │  Queue   │──►│ CDN │
                 │ local → S3  │             │ + worker │   └─────┘
                 └─────────────┘             │ (resize) │
                                             └──────────┘
```

- **Async processing** — for heavy load, move resize off the request path:
  store the original, enqueue a job (BullMQ/Redis), let a worker process it,
  expose a `processing → ready` status.
- **Object storage + CDN** — serve binaries from S3 via a CDN, not through the API.
- **Caching** — `Cache-Control`/`ETag` on raw images (already set) plus Redis for hot metadata.
- **Read replicas** — list/detail are read-heavy.

---

## Testing

```bash
npm test            # unit tests (no DB required)
npm run test:cov    # unit tests + coverage report
npm run test:e2e    # end-to-end (needs the DB: docker compose up -d db)
```

- **Unit** — image processing (real `sharp`), magic-byte validation pipe
  (incl. spoofed/`.php` and disallowed-type uploads), and the service with
  mocked repository/storage (incl. file rollback on DB failure).
- **E2E** (Supertest, real HTTP + PostgreSQL) — all endpoints, happy paths and
  error paths: bad file → 422, missing/invalid fields → 400, missing → 404,
  malformed id → 400, title filter, pagination.

---

## Approach

I started this task by planning the architecture and the security model (OWASP)
up front — the plan lives in [`docs/PLAN.md`](docs/PLAN.md). I use AI as a tool to
speed up planning, review, and edge-case hunting; every architectural decision and
line of code here is one I've reviewed and can explain.

---

## Configuration

All config is environment-driven (see [`.env.example`](.env.example)): ports,
public base URL, DB credentials, storage dir, upload/resize limits, and rate-limit
window. Secrets are never committed — `.env` is git-ignored.

## Project structure

```
src/
├── config/                 # typed env configuration
├── common/
│   ├── filters/            # global exception filter (consistent errors)
│   └── pipes/              # magic-byte image validation
├── storage/                # StorageService contract + Local implementation
├── images/                 # controller, service, entity, DTOs, processor
└── health/                 # liveness probe
test/                       # e2e (Supertest)
```

## License

MIT.
