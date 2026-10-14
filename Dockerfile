# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates libssl3 \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
ARG NEXT_PUBLIC_APP_NAME=""
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/db ./db
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN chmod +x /app/scripts/docker-entrypoint.sh \
 && chown -R node:node /app

USER node

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
