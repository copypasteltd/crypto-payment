import { loadApiRuntimeConfig } from "@lingban/config";

let cachedConfig: ReturnType<typeof loadApiRuntimeConfig> | null = null;

export function getApiRuntimeConfig() {
  if (!cachedConfig) {
    cachedConfig = loadApiRuntimeConfig();
  }

  return cachedConfig;
}

export function resetApiRuntimeConfigForTests() {
  cachedConfig = null;
}
