import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ProviderProfile,
  WorkspaceProviderBinding,
} from "@lingban/contracts";
import {
  providerProfileSchema,
  workspaceProviderBindingSchema,
} from "@lingban/contracts";
import { buildAtomicTempPath } from "@lingban/shared";
import { resolveApiStorageDir } from "../../app/storage.js";
import { providersStateSchema, type ProvidersState } from "./storage-schema.js";
import { seedProvidersState } from "./seed-data.js";

class ProvidersRepository {
  #initialized = false;
  #state: ProvidersState = providersStateSchema.parse({
    providers: [],
    bindings: [],
  });
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("providers")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "providers-state.json");
  }

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = await this.#loadState();
    this.#initialized = true;
    if (this.#state.providers.length === 0 && this.#state.bindings.length === 0) {
      await this.replaceState(seedProvidersState);
    }
  }

  listProviders() {
    return [...this.#state.providers].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.providerId.localeCompare(right.providerId)
    );
  }

  getProviderById(providerId: string) {
    return this.#state.providers.find((item) => item.providerId === providerId) ?? null;
  }

  listBindings() {
    return [...this.#state.bindings].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.bindingId.localeCompare(right.bindingId)
    );
  }

  getBindingById(bindingId: string) {
    return this.#state.bindings.find((item) => item.bindingId === bindingId) ?? null;
  }

  async saveProvider(record: ProviderProfile) {
    await this.init();
    const parsed = providerProfileSchema.parse(record);
    await this.#updateState((state) => ({
      ...state,
      providers: replaceByKey(state.providers, parsed, (item) => item.providerId),
    }));
    return parsed;
  }

  async saveBinding(record: WorkspaceProviderBinding) {
    await this.init();
    const parsed = workspaceProviderBindingSchema.parse(record);
    await this.#updateState((state) => ({
      ...state,
      bindings: replaceByKey(state.bindings, parsed, (item) => item.bindingId),
    }));
    return parsed;
  }

  async replaceState(state: ProvidersState) {
    const parsed = providersStateSchema.parse(state);
    this.#state = parsed;
    await this.#writeState(parsed);
  }

  async #loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return providersStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return providersStateSchema.parse({
        providers: [],
        bindings: [],
      });
    }
  }

  async #updateState(mutator: (state: ProvidersState) => ProvidersState) {
    const nextState = providersStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.#writeState(nextState);
  }

  async #writeState(state: ProvidersState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(providersStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const nextItems = [...items];
  const key = getKey(nextItem);
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);
  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

export const providersRepository = new ProvidersRepository();
