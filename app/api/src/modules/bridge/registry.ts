import {
  bridgeRegistryDiagnosticsSchema,
  bridgeRegistrationSchema,
  runControlCommandSchema,
  type BridgeRegistration,
  type BridgeRegistryDiagnostics,
  type RunControlCommand,
} from "@lingban/contracts";
import { toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import {
  bridgeRegistrationRepository,
  type BridgeRegistrationRepository,
} from "./repository.js";

export type RunBridgeController = {
  handle(command: RunControlCommand): Promise<unknown> | unknown;
};

export type RegisteredBridgeConnection = BridgeRegistration & {
  lastSeenAt: string;
  controllerAttached: boolean;
};

type BridgePersistenceOperation = "save" | "delete";

type BridgeRegistryMetricsState = BridgeRegistryDiagnostics["metrics"];

type BridgeRegistryLastSweepState = BridgeRegistryDiagnostics["lastSweep"];

type BridgeRegistryPersistenceErrorState = BridgeRegistryDiagnostics["lastPersistenceError"];

type BridgeRegistryOptions = {
  now?: () => string;
  staleAfterMs?: number;
  sweepIntervalMs?: number;
  repository?: BridgeRegistrationRepository;
};

class HttpBridgeController implements RunBridgeController {
  #baseUrl: string;
  #authToken?: string;

  constructor(baseUrl: string, authToken?: string) {
    this.#baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.#authToken = authToken;
  }

  async handle(command: RunControlCommand): Promise<unknown> {
    const parsed = runControlCommandSchema.parse(command);
    const response = await fetch(`${this.#baseUrl}/control`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.#authToken ? { "x-lingban-control-token": this.#authToken } : {}),
      },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Bridge control request failed (${response.status} ${response.statusText}): ${text || "<empty>"}`
      );
    }

    const raw = await response.text();
    return raw ? (JSON.parse(raw) as unknown) : null;
  }
}

export class InMemoryBridgeRegistry {
  #connections = new Map<string, BridgeRegistration>();
  #controllers = new Map<string, RunBridgeController>();
  #pendingCommands = new Map<string, RunControlCommand[]>();
  #dispatchChains = new Map<string, Promise<unknown>>();
  #defaultNow = () => new Date().toISOString();
  #now: () => string;
  #staleAfterMs?: number;
  #sweepIntervalMs?: number;
  #repository: BridgeRegistrationRepository;
  #initialized = false;
  #persistenceChain: Promise<void> = Promise.resolve();
  #sweepTimer: NodeJS.Timeout | null = null;
  #sweeperActive = false;
  #sweepInFlight: Promise<void> | null = null;
  #persistencePendingCount = 0;
  #metrics: BridgeRegistryMetricsState = {
    registrationsTotal: 0,
    unregistrationsTotal: 0,
    queuedCommandsTotal: 0,
    forwardedCommandsTotal: 0,
    staleEvictionsTotal: 0,
    persistedDeleteQueueTotal: 0,
    persistenceSaveFailuresTotal: 0,
    persistenceDeleteFailuresTotal: 0,
    sweepRunsTotal: 0,
    sweepEvictionsTotal: 0,
    sweepFailuresTotal: 0,
  };
  #lastSweep: BridgeRegistryLastSweepState = {
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    evictedCount: 0,
    error: null,
  };
  #lastPersistenceError: BridgeRegistryPersistenceErrorState = {
    operation: null,
    occurredAt: null,
    message: null,
  };

  constructor(options: BridgeRegistryOptions = {}) {
    this.#now = options.now ?? this.#defaultNow;
    this.#staleAfterMs = options.staleAfterMs;
    this.#sweepIntervalMs = options.sweepIntervalMs;
    this.#repository = options.repository ?? bridgeRegistrationRepository;
  }

  configure(options: BridgeRegistryOptions = {}) {
    if ("now" in options) {
      this.#now = options.now ?? this.#defaultNow;
    }

    if ("staleAfterMs" in options) {
      this.#staleAfterMs = options.staleAfterMs;
    }

    if ("sweepIntervalMs" in options) {
      this.#sweepIntervalMs = options.sweepIntervalMs;
      if (this.#sweeperActive) {
        void this.stopSweeper().then(() => {
          this.startSweeper();
        });
      }
    }

    if ("repository" in options && options.repository) {
      this.#repository = options.repository;
      this.#initialized = false;
    }

    return this;
  }

  async init(options: { forceReload?: boolean } = {}) {
    await this.#repository.init();

    if (this.#initialized && !options.forceReload) {
      return;
    }

    this.#connections.clear();
    this.#controllers.clear();
    this.#pendingCommands.clear();
    this.#dispatchChains.clear();

    let removedStalePersistedEntries = false;
    for (const registration of await this.#repository.list()) {
      if (this.#isStale(registration)) {
        this.#metrics.persistedDeleteQueueTotal += 1;
        void this.#queuePersistence("delete", () => this.#repository.delete(registration.runId));
        removedStalePersistedEntries = true;
        continue;
      }

      this.#connections.set(registration.runId, registration);
      if (registration.control) {
        this.#attachController(
          registration.runId,
          new HttpBridgeController(registration.control.baseUrl, registration.control.authToken)
        );
      }
    }

    this.#initialized = true;

    if (removedStalePersistedEntries) {
      await this.flushPersistence();
    }
  }

  async flushPersistence() {
    await this.#persistenceChain;
  }

  async clearPersistedState() {
    await this.stopSweeper();
    this.#connections.clear();
    this.#controllers.clear();
    this.#pendingCommands.clear();
    this.#dispatchChains.clear();
    await this.#repository.clear();
    this.#initialized = false;
  }

  #enqueue(runId: string, task: () => Promise<unknown> | unknown) {
    const previous = this.#dispatchChains.get(runId) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.#dispatchChains.set(
      runId,
      next.catch(() => undefined)
    );
    return next;
  }

  #recordPersistenceError(operation: BridgePersistenceOperation, error: unknown) {
    this.#lastPersistenceError = {
      operation,
      occurredAt: this.#now(),
      message: error instanceof Error ? error.message : String(error),
    };

    if (operation === "save") {
      this.#metrics.persistenceSaveFailuresTotal += 1;
      return;
    }

    this.#metrics.persistenceDeleteFailuresTotal += 1;
  }

  #queuePersistence(operation: BridgePersistenceOperation, task: () => Promise<void>) {
    this.#persistencePendingCount += 1;
    const wrappedTask = async () => {
      try {
        await task();
      } catch (error) {
        this.#recordPersistenceError(operation, error);
        throw error;
      } finally {
        this.#persistencePendingCount = Math.max(0, this.#persistencePendingCount - 1);
      }
    };

    const next = this.#persistenceChain.catch(() => undefined).then(wrappedTask);
    this.#persistenceChain = next.catch(() => undefined);
    return next;
  }

  #resolveLastSeenAt(registration: BridgeRegistration) {
    return registration.lastSeenAt ?? registration.connectedAt;
  }

  #resolveStaleAfterMs() {
    return Math.max(
      1,
      this.#staleAfterMs ?? getApiRuntimeConfig().bridgeRegistrationStaleAfterMs
    );
  }

  #resolveSweepIntervalMs() {
    return Math.max(
      1,
      this.#sweepIntervalMs ?? getApiRuntimeConfig().bridgeRegistrationSweepIntervalMs
    );
  }

  #isStale(registration: BridgeRegistration) {
    const lastSeenAt = Date.parse(this.#resolveLastSeenAt(registration));
    const now = Date.parse(this.#now());

    if (!Number.isFinite(lastSeenAt) || !Number.isFinite(now)) {
      return false;
    }

    return now - lastSeenAt > this.#resolveStaleAfterMs();
  }

  #evictStaleRegistration(runId: string, options: { persist?: boolean } = {}) {
    const current = this.#connections.get(runId);
    if (!current || !this.#isStale(current)) {
      return false;
    }

    this.#connections.delete(runId);
    this.#controllers.delete(runId);
    this.#pendingCommands.delete(runId);
    this.#dispatchChains.delete(runId);
    this.#metrics.staleEvictionsTotal += 1;
    if (options.persist) {
      this.#metrics.persistedDeleteQueueTotal += 1;
      void this.#queuePersistence("delete", () => this.#repository.delete(runId));
    }
    return true;
  }

  #scheduleNextSweep() {
    if (!this.#sweeperActive) {
      return;
    }

    this.#sweepTimer = setTimeout(() => {
      const runSweep = async () => {
        await this.sweepExpired();
      };

      this.#sweepInFlight = runSweep()
        .catch(() => undefined)
        .finally(() => {
          this.#sweepInFlight = null;
          this.#scheduleNextSweep();
        });
    }, this.#resolveSweepIntervalMs());
    this.#sweepTimer.unref?.();
  }

  startSweeper() {
    if (this.#sweeperActive) {
      return;
    }

    this.#sweeperActive = true;
    this.#scheduleNextSweep();
  }

  async stopSweeper() {
    this.#sweeperActive = false;
    if (this.#sweepTimer) {
      clearTimeout(this.#sweepTimer);
      this.#sweepTimer = null;
    }

    await this.#sweepInFlight?.catch(() => undefined);
  }

  async sweepExpired() {
    const startedAt = Date.parse(this.#now());
    this.#metrics.sweepRunsTotal += 1;
    this.#lastSweep = {
      startedAt: this.#now(),
      finishedAt: null,
      durationMs: null,
      evictedCount: 0,
      error: null,
    };

    const evictedRunIds: string[] = [];

    try {
      for (const runId of [...this.#connections.keys()]) {
        if (this.#evictStaleRegistration(runId, { persist: true })) {
          evictedRunIds.push(runId);
        }
      }

      if (evictedRunIds.length > 0) {
        await this.flushPersistence();
      }

      this.#metrics.sweepEvictionsTotal += evictedRunIds.length;
      const finishedAt = this.#now();
      const finishedAtMs = Date.parse(finishedAt);
      this.#lastSweep = {
        startedAt: this.#lastSweep.startedAt,
        finishedAt,
        durationMs:
          Number.isFinite(startedAt) && Number.isFinite(finishedAtMs)
            ? Math.max(0, finishedAtMs - startedAt)
            : null,
        evictedCount: evictedRunIds.length,
        error: null,
      };
    } catch (error) {
      this.#metrics.sweepFailuresTotal += 1;
      const finishedAt = this.#now();
      const finishedAtMs = Date.parse(finishedAt);
      this.#lastSweep = {
        startedAt: this.#lastSweep.startedAt,
        finishedAt,
        durationMs:
          Number.isFinite(startedAt) && Number.isFinite(finishedAtMs)
            ? Math.max(0, finishedAtMs - startedAt)
            : null,
        evictedCount: evictedRunIds.length,
        error: error instanceof Error ? error.message : String(error),
      };
      throw error;
    }

    return {
      evictedRunIds,
    };
  }

  #attachController(runId: string, controller: RunBridgeController) {
    this.#controllers.set(runId, controller);
    const pending = this.#pendingCommands.get(runId) ?? [];
    this.#pendingCommands.delete(runId);
    this.#metrics.forwardedCommandsTotal += pending.length;

    for (const command of pending) {
      void this.#enqueue(runId, () => controller.handle(command)).catch((error) => {
        console.error(
          `[lingban-bridge-registry] failed to replay queued command for ${runId}: ${toErrorMessage(error)}`
        );
      });
    }
  }

  getDiagnostics(): BridgeRegistryDiagnostics {
    const connections = [...this.#connections.entries()]
      .map(([runId, registration]) => {
        const pendingCommandsCount = this.#pendingCommands.get(runId)?.length ?? 0;
        return {
          ...registration,
          lastSeenAt: this.#resolveLastSeenAt(registration),
          controllerAttached: this.#controllers.has(runId),
          pendingCommandsCount,
          stale: this.#isStale(registration),
        };
      })
      .sort((left, right) => left.runId.localeCompare(right.runId));

    return bridgeRegistryDiagnosticsSchema.parse({
      initialized: this.#initialized,
      repositoryKind: this.#repository.kind ?? "unknown",
      sweeperActive: this.#sweeperActive,
      staleAfterMs: this.#resolveStaleAfterMs(),
      sweepIntervalMs: this.#resolveSweepIntervalMs(),
      registeredConnectionsCount: connections.length,
      controllerAttachedCount: connections.filter((item) => item.controllerAttached).length,
      pendingRunsCount: this.#pendingCommands.size,
      pendingCommandsCount: [...this.#pendingCommands.values()].reduce(
        (sum, items) => sum + items.length,
        0
      ),
      staleCandidatesCount: connections.filter((item) => item.stale).length,
      persistencePendingCount: this.#persistencePendingCount,
      metrics: this.#metrics,
      lastPersistenceError: this.#lastPersistenceError,
      lastSweep: this.#lastSweep,
      connections,
    });
  }

  register(input: BridgeRegistration): RegisteredBridgeConnection {
    const parsed = bridgeRegistrationSchema.parse(input);
    this.#connections.set(parsed.runId, parsed);
    this.#metrics.registrationsTotal += 1;
    if (parsed.control) {
      this.#attachController(
        parsed.runId,
        new HttpBridgeController(parsed.control.baseUrl, parsed.control.authToken)
      );
    }

    void this.#queuePersistence("save", async () => {
      await this.#repository.save(parsed);
    });

    return this.get(parsed.runId)!;
  }

  attachController(runId: string, controller: RunBridgeController) {
    this.#attachController(runId, controller);

    return this.get(runId);
  }

  detachController(runId: string) {
    this.#controllers.delete(runId);
  }

  unregister(runId: string) {
    const hadRegistration =
      this.#connections.has(runId) ||
      this.#controllers.has(runId) ||
      this.#pendingCommands.has(runId) ||
      this.#dispatchChains.has(runId);
    this.#controllers.delete(runId);
    this.#connections.delete(runId);
    this.#pendingCommands.delete(runId);
    this.#dispatchChains.delete(runId);
    if (hadRegistration) {
      this.#metrics.unregistrationsTotal += 1;
      this.#metrics.persistedDeleteQueueTotal += 1;
    }
    void this.#queuePersistence("delete", async () => {
      await this.#repository.delete(runId);
    });
  }

  get(runId: string): RegisteredBridgeConnection | null {
    this.#evictStaleRegistration(runId, { persist: true });
    const current = this.#connections.get(runId);
    if (!current) {
      return null;
    }

    return {
      ...current,
      lastSeenAt: this.#resolveLastSeenAt(current),
      controllerAttached: this.#controllers.has(runId),
    };
  }

  async dispatch(runId: string, command: RunControlCommand | unknown) {
    const parsed = runControlCommandSchema.parse(command);
    this.#evictStaleRegistration(runId, { persist: true });
    const controller = this.#controllers.get(runId);

    if (!controller) {
      const pending = this.#pendingCommands.get(runId) ?? [];
      pending.push(parsed);
      this.#pendingCommands.set(runId, pending);
      this.#metrics.queuedCommandsTotal += 1;
      return {
        ok: true,
        queued: true,
        command: parsed.type,
      };
    }

    this.#metrics.forwardedCommandsTotal += 1;
    return this.#enqueue(runId, () => controller.handle(parsed));
  }
}

export const bridgeRegistry = new InMemoryBridgeRegistry();
