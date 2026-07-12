FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/lingban

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY app/api ./app/api
COPY app/run-worker ./app/run-worker
COPY app/container-bridge ./app/container-bridge

RUN corepack enable \
  && corepack prepare pnpm@10.0.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm build:backend

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3100

COPY infra/docker/api-entrypoint.sh /usr/local/bin/lingban-api-entrypoint
RUN chmod +x /usr/local/bin/lingban-api-entrypoint

EXPOSE 3100

ENTRYPOINT ["/usr/local/bin/lingban-api-entrypoint"]
