FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    docker.io \
    git \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/lingban

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY app/run-worker ./app/run-worker
COPY app/container-bridge ./app/container-bridge

RUN corepack enable \
  && corepack prepare pnpm@10.0.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @lingban/run-worker build

ENV NODE_ENV=production
ENV LINGBAN_WORKER_OPS_HOST=0.0.0.0
ENV LINGBAN_WORKER_OPS_PORT=3901

COPY infra/docker/worker-entrypoint.sh /usr/local/bin/lingban-worker-entrypoint
RUN chmod +x /usr/local/bin/lingban-worker-entrypoint

EXPOSE 3901

ENTRYPOINT ["/usr/local/bin/lingban-worker-entrypoint"]
