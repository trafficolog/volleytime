# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY . .
# типы + сборка в JS: в рантайме нет tsx и исходников (Task 9.9.10)
RUN pnpm -F @volley-time/bot exec tsc --noEmit
RUN pnpm -F @volley-time/bot build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
WORKDIR /app/apps/bot
# webhook (8443) + internal notify (3001)
EXPOSE 8443 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1
CMD ["node", "dist/index.js"]
