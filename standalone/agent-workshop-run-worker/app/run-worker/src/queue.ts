import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type Job,
  type Processor,
} from "bullmq";
import { loadWorkerRuntimeConfig, type WorkerRuntimeConfig } from "@lingban/config";
import {
  cleanupRunJobPayloadSchema,
  startRunJobPayloadSchema,
  type CleanupRunJobPayload,
  type StartRunJobPayload,
} from "@lingban/contracts";

export const RUN_START_JOB_NAME = "run.start";
export const RUN_CLEANUP_JOB_NAME = "run.cleanup";
export const RUN_START_DLQ_JOB_NAME = "run.start.dlq";
export const RUN_CLEANUP_DLQ_JOB_NAME = "run.cleanup.dlq";

type QueueJobLike = {
  getState(): Promise<string> | string;
  remove(): Promise<unknown> | unknown;
};

type DeadLetterQueueLike<TPayload> = {
  add(
    name: string,
    payload: TPayload,
    options?: { jobId?: string }
  ): Promise<unknown> | unknown;
  close(): Promise<unknown> | unknown;
};

export type RunStartQueueLike = {
  getJob(jobId: string): Promise<QueueJobLike | undefined> | QueueJobLike | undefined;
  add(
    name: string,
    payload: StartRunJobPayload,
    options?: { jobId?: string; delay?: number }
  ): Promise<unknown> | unknown;
  close(): Promise<unknown> | unknown;
};

export type RunQueueDeadLetterRecord<TPayload> = {
  runId: string;
  queueName: string;
  jobName: string;
  jobId: string | null;
  attemptsMade: number;
  maxAttempts: number;
  failedAt: string;
  error: string;
  payload: TPayload | null;
};

export type RunStartDeadLetterRecord = RunQueueDeadLetterRecord<StartRunJobPayload>;
export type RunCleanupDeadLetterRecord = RunQueueDeadLetterRecord<CleanupRunJobPayload>;
export type RunStartDeadLetterQueueLike = DeadLetterQueueLike<RunStartDeadLetterRecord>;
export type RunCleanupDeadLetterQueueLike = DeadLetterQueueLike<RunCleanupDeadLetterRecord>;

export type RunCleanupQueueLike = {
  getJob(jobId: string): Promise<QueueJobLike | undefined> | QueueJobLike | undefined;
  add(
    name: string,
    payload: CleanupRunJobPayload,
    options?: { jobId?: string; delay?: number }
  ): Promise<unknown> | unknown;
  close(): Promise<unknown> | unknown;
};

export type RunQueueEventsLike = {
  waitUntilReady(): Promise<unknown>;
  close(): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): RunQueueEventsLike | unknown;
};

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("LINGBAN_REDIS_URL must use redis:// or rediss://");
  }

  const dbPath = parsed.pathname.replace(/^\/+/, "");
  const db = dbPath ? Number.parseInt(dbPath, 10) : 0;
  if (!Number.isInteger(db) || db < 0) {
    throw new Error("LINGBAN_REDIS_URL contains an invalid database index");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === "rediss:" ? 6380 : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function requireRedisUrl(config: WorkerRuntimeConfig) {
  if (!config.redisUrl) {
    throw new Error(
      "LINGBAN_REDIS_URL is required when runtime dispatch mode is bullmq"
    );
  }

  return config.redisUrl;
}

export function createBullmqConnection(config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()) {
  return parseRedisConnection(requireRedisUrl(config));
}

function buildRetryOptions(attempts: number, backoffDelayMs: number) {
  return {
    attempts: Math.max(1, attempts),
    backoff: {
      type: "exponential" as const,
      delay: Math.max(1, backoffDelayMs),
    },
  };
}

export function createRunStartQueue(config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()) {
  return new Queue<StartRunJobPayload>(config.runStartQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
    defaultJobOptions: {
      ...buildRetryOptions(config.runStartJobAttempts, config.runStartJobBackoffMs),
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}

export async function enqueueRunStartJob(
  queue: RunStartQueueLike,
  payload: StartRunJobPayload
) {
  const parsed = startRunJobPayloadSchema.parse(payload);
  const existing = await queue.getJob(parsed.run.runId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "failed" && state !== "completed") {
      return existing;
    }
    await existing.remove();
  }

  return queue.add(RUN_START_JOB_NAME, parsed, {
    jobId: parsed.run.runId,
  });
}

export function createRunCleanupQueue(config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()) {
  return new Queue<CleanupRunJobPayload>(config.runCleanupQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
    defaultJobOptions: {
      ...buildRetryOptions(config.runCleanupJobAttempts, config.runCleanupJobBackoffMs),
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
}

export function createRunStartDeadLetterQueue(
  config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()
) {
  return new Queue<RunStartDeadLetterRecord>(config.runStartDlqQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

export function createRunCleanupDeadLetterQueue(
  config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()
) {
  return new Queue<RunCleanupDeadLetterRecord>(config.runCleanupDlqQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

export function createRunStartQueueEvents(config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()) {
  return new QueueEvents(config.runStartQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
  });
}

export function createRunCleanupQueueEvents(
  config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()
) {
  return new QueueEvents(config.runCleanupQueueName, {
    prefix: config.queuePrefix,
    connection: createBullmqConnection(config),
  });
}

export async function enqueueRunCleanupJob(
  queue: RunCleanupQueueLike,
  payload: CleanupRunJobPayload,
  options?: { delayMs?: number }
) {
  const parsed = cleanupRunJobPayloadSchema.parse(payload);
  const existing = await queue.getJob(parsed.runId);
  if (existing) {
    await existing.remove();
  }

  return queue.add(RUN_CLEANUP_JOB_NAME, parsed, {
    jobId: parsed.runId,
    delay: Math.max(0, options?.delayMs ?? 0),
  });
}

export function createRunStartWorker(
  processor: Processor<StartRunJobPayload>,
  config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()
) {
  return new Worker<StartRunJobPayload>(
    config.runStartQueueName,
    async (job: Job<StartRunJobPayload>) => {
      job.data = startRunJobPayloadSchema.parse(job.data);
      return await processor(job);
    },
    {
      prefix: config.queuePrefix,
      connection: createBullmqConnection(config),
      concurrency: config.maxConcurrentRuns,
    }
  );
}

export function createRunCleanupWorker(
  processor: Processor<CleanupRunJobPayload>,
  config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()
) {
  return new Worker<CleanupRunJobPayload>(
    config.runCleanupQueueName,
    async (job: Job<CleanupRunJobPayload>) => {
      job.data = cleanupRunJobPayloadSchema.parse(job.data);
      return await processor(job);
    },
    {
      prefix: config.queuePrefix,
      connection: createBullmqConnection(config),
      concurrency: config.maxConcurrentRuns,
    }
  );
}
