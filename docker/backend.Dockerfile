FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=dependencies /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=dependencies /app/apps/backend/node_modules ./apps/backend/node_modules
COPY . .
RUN pnpm --filter @dds/backend build
RUN pnpm --filter @dds/shared build
RUN pnpm --filter @dds/database build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 dds
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database/src/migrate.ts ./packages/database/src/migrate.ts
RUN mkdir -p /data && chown dds:nodejs /data
USER dds
EXPOSE 3001
CMD ["node", "apps/backend/dist/index.js"]
