# Ta' Spiru API — pnpm monorepo build
FROM node:22-alpine AS build
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @ta-spiru/api...

COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @ta-spiru/database db:generate \
 && pnpm --filter @ta-spiru/shared build \
 && pnpm --filter @ta-spiru/database build \
 && pnpm --filter @ta-spiru/api build \
 && pnpm prune --prod

FROM node:22-alpine
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3001
# Apply migrations, then serve. Seed once with:
#   docker compose run --rm api pnpm --filter @ta-spiru/database db:seed
CMD ["sh", "-c", "pnpm --filter @ta-spiru/database exec prisma migrate deploy && node apps/api/dist/main.js"]
