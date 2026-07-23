# Ta' Spiru web — Next.js standalone build
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Baked into client bundles; must be the public origin (Caddy routes /api/* to the API).
ARG NEXT_PUBLIC_API_URL=https://app.taspiru.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @ta-spiru/web...

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @ta-spiru/shared build && pnpm --filter @ta-spiru/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
