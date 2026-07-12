FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ARG OPENAI_CODEX_VERSION=0.144.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    iptables \
    jq \
    python3 \
    python3-pip \
    ripgrep \
    util-linux \
    unzip \
    zip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/lingban

RUN npm install -g @openai/codex@${OPENAI_CODEX_VERSION} \
  && codex --version

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY app/container-bridge ./app/container-bridge

RUN corepack enable \
  && corepack prepare pnpm@10.0.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @lingban/contracts --filter @lingban/container-bridge build

RUN npm install -g @playwright/test@latest \
  && npx playwright install --with-deps chromium

RUN mkdir -p \
  /workspace/target \
  /workspace/inputs \
  /workspace/outputs \
  /workspace/state \
  /workspace/runtime \
  /workspace/codex-home \
  /workspace/home \
  /workspace/tmp \
  /workspace/browser-profile \
  /workspace/mcp \
  /workspace/secrets \
  /workspace/logs

COPY infra/docker/entrypoint.sh /usr/local/bin/lingban-runner-entrypoint
RUN chmod +x /usr/local/bin/lingban-runner-entrypoint

ENV HOME=/workspace/home
ENV CODEX_HOME=/workspace/codex-home
ENV TMPDIR=/workspace/tmp
ENV TARGET_PATH=/workspace/target

ENTRYPOINT ["/usr/local/bin/lingban-runner-entrypoint"]
