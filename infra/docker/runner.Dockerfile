ARG RUNNER_BASE_IMAGE=node:22-bookworm-slim
FROM ${RUNNER_BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive
ENV CI=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ARG OPENAI_CODEX_VERSION=0.144.1
ARG NODE_RUNTIME_VERSION=22.14.0
ARG PLAYWRIGHT_MCP_VERSION=0.0.78
ARG PLAYWRIGHT_VERSION=1.62.0-alpha-1783623505000

RUN if command -v bash >/dev/null 2>&1 \
    && command -v curl >/dev/null 2>&1 \
    && command -v dig >/dev/null 2>&1 \
    && command -v git >/dev/null 2>&1 \
    && command -v ip >/dev/null 2>&1 \
    && command -v iptables >/dev/null 2>&1 \
    && command -v jq >/dev/null 2>&1 \
    && command -v nc >/dev/null 2>&1 \
    && command -v ssh >/dev/null 2>&1 \
    && command -v python3 >/dev/null 2>&1 \
    && command -v pip3 >/dev/null 2>&1 \
    && command -v rg >/dev/null 2>&1 \
    && command -v setpriv >/dev/null 2>&1 \
    && command -v unzip >/dev/null 2>&1 \
    && command -v zip >/dev/null 2>&1; then \
    echo "runner system packages already available"; \
  else \
    apt-get update \
      && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        dnsutils \
        git \
        iproute2 \
        iptables \
        jq \
        netcat-openbsd \
        openssh-client \
        python3 \
        python3-pip \
        ripgrep \
        util-linux \
        unzip \
        zip \
      && rm -rf /var/lib/apt/lists/*; \
  fi

RUN CURRENT_NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')" \
  && if [ "${CURRENT_NODE_MAJOR}" -lt 20 ]; then \
    curl -fsSL "https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}/node-v${NODE_RUNTIME_VERSION}-linux-x64.tar.gz" \
      | tar -xz -C /usr/local --strip-components=1; \
  fi \
  && node --version \
  && npm --version

WORKDIR /opt/lingban

RUN find /opt/lingban -mindepth 1 -maxdepth 1 -exec rm -rf {} +

RUN if codex --version 2>/dev/null | grep -F "${OPENAI_CODEX_VERSION}" >/dev/null; then \
    codex --version; \
  else \
    npm install -g @openai/codex@${OPENAI_CODEX_VERSION} \
      && codex --version; \
  fi

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY app/container-bridge ./app/container-bridge

RUN npm install -g pnpm@10.0.0 \
  && pnpm install --frozen-lockfile \
  && pnpm rebuild node-pty \
  && pnpm --filter @lingban/contracts --filter @lingban/container-bridge build

RUN npm install -g --force @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} \
  && playwright-mcp --help >/dev/null \
  && if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then \
    node "$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js" install --with-deps chromium; \
  fi \
  && node -e "const p=require('$(npm root -g)/@playwright/mcp/node_modules/playwright/package.json'); if(p.version!=='${PLAYWRIGHT_VERSION}') throw new Error('unexpected Playwright version '+p.version)"

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
COPY infra/docker/playwright-mcp-entrypoint.sh /usr/local/bin/lingban-playwright-mcp
RUN chmod +x \
  /usr/local/bin/lingban-runner-entrypoint \
  /usr/local/bin/lingban-playwright-mcp

ENV HOME=/workspace/home
ENV CODEX_HOME=/workspace/codex-home
ENV TMPDIR=/workspace/tmp
ENV TARGET_PATH=/workspace/target

ENTRYPOINT ["/usr/local/bin/lingban-runner-entrypoint"]
