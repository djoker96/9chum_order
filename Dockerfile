# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG NODE_IMAGE=node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03

FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    NEXT_PUBLIC_APP_NAME="9Chum Order"
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public \
    && npm run db:generate \
    && npm run build -- --webpack

FROM base AS app
ARG VCS_REF=unknown
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/djoker96/9chum_order" \
      org.opencontainers.image.revision="${VCS_REF}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN mkdir -p /app/.next/cache \
    && chown -R node:node /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

FROM base AS ops
ARG VCS_REF=unknown
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/djoker96/9chum_order" \
      org.opencontainers.image.revision="${VCS_REF}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src/server/auth/password.ts ./src/server/auth/password.ts
COPY --chown=root:root compose.production.yml /deploy-bundle/compose.production.yml
COPY --chown=root:root deploy /deploy-bundle/deploy
COPY --chown=root:root scripts/deploy /deploy-bundle/scripts/deploy
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public \
    ./node_modules/.bin/prisma generate \
    && chmod 0755 /deploy-bundle/deploy/postgres/init-app.sh \
      /deploy-bundle/scripts/deploy/*.sh \
    && cd /deploy-bundle \
    && find . -type f ! -name SHA256SUMS -print0 \
      | sort -z \
      | xargs -0 sha256sum > SHA256SUMS
USER node
CMD ["./node_modules/.bin/prisma", "--version"]
