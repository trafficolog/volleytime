# syntax=docker/dockerfile:1
# Образ миграций (Task 9.9.4): отдельная стадия деплоя, падение останавливает выкладку.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @volley-time/db...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY packages/db ./packages/db
COPY package.json pnpm-workspace.yaml ./
WORKDIR /app/packages/db
# db:migrate → tsx src/migrate.ts; выходной код пробрасывается наружу
CMD ["pnpm", "exec", "tsx", "src/migrate.ts"]
