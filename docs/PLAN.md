# Implementation Plan

This document captures the plan I drew up **before writing code**, so the
reasoning behind the implementation is visible alongside the result.

## Goal

A REST API to upload and serve images:

- `POST /images` — upload + `title`, optional resize via `width`/`height`,
  binary to storage, metadata to the database.
- `GET /images` — list with `id, url, title, width, height`, filter by
  "title contains {text}", paginated.
- `GET /images/:id` — single image by id.

## Technology choices

| Area        | Choice                | Why |
| ----------- | --------------------- | --- |
| Framework   | NestJS                | Preferred in the task; structure, DI, validation, Swagger out of the box. |
| Database    | PostgreSQL + TypeORM  | Preferred in the task; relational metadata, good indexing. |
| Storage     | Filesystem (abstracted) | Preferred in the task; abstraction keeps S3/Azure a drop-in swap. |
| Images      | sharp                 | Fast, safe resize + re-encode. |
| Docs        | @nestjs/swagger       | OpenAPI v3 requirement. |
| Tests       | Jest + Supertest      | Nest default; unit + e2e. |
| Dev env     | docker-compose        | One command brings up API + DB. |

## Architecture

- **ImagesModule** — controller, service, DTOs (validated with `class-validator`).
- **StorageService (abstract)** → `LocalStorageService`. Everything depends on the
  contract, never on the filesystem, so the backend is swappable and the API stays
  stateless.
- **ImageProcessorService** — wraps sharp (resize + WebP re-encode).
- **Image entity** — metadata + storage key; `title` indexed for the list filter.
- **AllExceptionsFilter** — one consistent, traceable error envelope.

## Security model (OWASP Top 10)

The three highest-impact controls for an image-upload API:

1. **Validate by magic bytes**, not extension or `Content-Type` (A05).
2. **Limits** — max file size and max resize dimensions (A04, anti DoS/image-bomb).
3. **Re-encode + app-generated UUID filenames** — strips embedded payloads (A08)
   and prevents path traversal (A05).

Plus: `helmet`, rate limiting, parameterised queries, strict DTO whitelisting,
`nosniff` on served files.

## Scalability

Built now: storage abstraction, stateless API, indexed + paginated queries.
Documented as next steps: async resize via a queue, S3 + CDN for delivery,
caching, read replicas. (Diagram in the README.)

## Quality bars set for myself

- **Swagger**: not a skeleton — real descriptions and request/response examples.
- **Errors**: every failure tells you *what* and *where* (field-level messages +
  a `traceId` that's also logged), so a bug is easy to locate.
- **Tests**: cover happy paths and the security-relevant error paths.

## Build order

1. Project scaffold + docker-compose (Postgres).
2. Entity + storage abstraction.
3. `POST /images` (upload, validation, sharp, persist).
4. `GET /images` + `GET /images/:id` (filter, pagination).
5. OWASP hardening + global exception filter.
6. Tests (unit + e2e).
7. Swagger + README.

---

*On process:* I plan with AI assistance and use it for review and edge-case
hunting, but I drive the design and own every decision in this repository.
