# ── Build stage ───────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# storage dir for local file storage (mounted as volume in compose)
RUN mkdir -p /app/storage

EXPOSE 3000
CMD ["node", "dist/main"]
