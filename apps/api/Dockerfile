FROM oven/bun:1.2.11-alpine AS base
WORKDIR /app

FROM base AS deps
COPY bun.lock package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN bun install --frozen-lockfile --production

FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/src apps/api/src
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/contracts/src packages/contracts/src

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "run", "start"]
