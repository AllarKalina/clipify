FROM oven/bun:1.2.11-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN bun install --production

FROM base AS runner
COPY package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src

EXPOSE 3000
CMD ["bun", "run", "start"]
