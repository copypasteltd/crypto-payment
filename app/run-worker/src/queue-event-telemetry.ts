import type {
  WorkerQueueEventDiagnostics,
  WorkerQueueObservedEvent,
  WorkerQueueTelemetryName,
} from "./observability.js";

type QueueEventsEmitterLike = {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
};

const observedEvents = [
  "added",
  "active",
  "completed",
  "failed",
  "stalled",
  "delayed",
  "waiting",
  "drained",
  "error",
] as const satisfies readonly WorkerQueueObservedEvent[];

function createEventCounts(): Record<WorkerQueueObservedEvent, number> {
  return {
    added: 0,
    active: 0,
    completed: 0,
    failed: 0,
    stalled: 0,
    delayed: 0,
    waiting: 0,
    drained: 0,
    error: 0,
  };
}

function createQueueDiagnostics(queue: WorkerQueueTelemetryName): WorkerQueueEventDiagnostics {
  return {
    queue,
    counts: createEventCounts(),
    lastEventName: null,
    lastEventAt: null,
    lastEventId: null,
    lastJobId: null,
    lastPrev: null,
    lastDelayMs: null,
    lastFailedReason: null,
    lastErrorMessage: null,
  };
}

export class BullmqQueueEventTelemetry {
  #now: () => string;
  #queues: Record<WorkerQueueTelemetryName, WorkerQueueEventDiagnostics> = {
    start: createQueueDiagnostics("start"),
    cleanup: createQueueDiagnostics("cleanup"),
  };

  constructor(options?: { now?: () => string }) {
    this.#now = options?.now ?? (() => new Date().toISOString());
  }

  attach(queue: WorkerQueueTelemetryName, emitter: QueueEventsEmitterLike) {
    emitter.on("added", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "added", {
        id,
        jobId: args.jobId ?? null,
      });
    });
    emitter.on("active", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string; prev?: string };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "active", {
        id,
        jobId: args.jobId ?? null,
        prev: args.prev ?? null,
      });
    });
    emitter.on("completed", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string; prev?: string };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "completed", {
        id,
        jobId: args.jobId ?? null,
        prev: args.prev ?? null,
      });
    });
    emitter.on("failed", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as {
        jobId?: string;
        prev?: string;
        failedReason?: string;
      };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "failed", {
        id,
        jobId: args.jobId ?? null,
        prev: args.prev ?? null,
        failedReason: args.failedReason ?? null,
      });
    });
    emitter.on("stalled", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "stalled", {
        id,
        jobId: args.jobId ?? null,
      });
    });
    emitter.on("delayed", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string; delay?: number };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "delayed", {
        id,
        jobId: args.jobId ?? null,
        delayMs: args.delay ?? null,
      });
    });
    emitter.on("waiting", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string; prev?: string };
      const id = (rawArgs[1] ?? null) as string | null;
      this.#record(queue, "waiting", {
        id,
        jobId: args.jobId ?? null,
        prev: args.prev ?? null,
      });
    });
    emitter.on("drained", (...rawArgs: unknown[]) => {
      const id = (rawArgs[0] ?? null) as string | null;
      this.#record(queue, "drained", {
        id,
      });
    });
    emitter.on("error", (...rawArgs: unknown[]) => {
      const error = rawArgs[0];
      this.#record(queue, "error", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
  }

  getDiagnostics() {
    return {
      start: this.#cloneQueue("start"),
      cleanup: this.#cloneQueue("cleanup"),
    };
  }

  #cloneQueue(queue: WorkerQueueTelemetryName): WorkerQueueEventDiagnostics {
    const diagnostics = this.#queues[queue];
    return {
      ...diagnostics,
      counts: {
        ...diagnostics.counts,
      },
    };
  }

  #record(
    queue: WorkerQueueTelemetryName,
    eventName: WorkerQueueObservedEvent,
    input: {
      id?: string | null;
      jobId?: string | null;
      prev?: string | null;
      delayMs?: number | null;
      failedReason?: string | null;
      errorMessage?: string | null;
    }
  ) {
    const diagnostics = this.#queues[queue];
    diagnostics.counts[eventName] += 1;
    diagnostics.lastEventName = eventName;
    diagnostics.lastEventAt = this.#now();
    diagnostics.lastEventId = input.id ?? null;
    diagnostics.lastJobId = input.jobId ?? null;
    diagnostics.lastPrev = input.prev ?? null;
    diagnostics.lastDelayMs = input.delayMs ?? null;
    diagnostics.lastFailedReason = input.failedReason ?? null;
    diagnostics.lastErrorMessage = input.errorMessage ?? null;
  }
}

export { observedEvents as bullmqObservedQueueEvents };
