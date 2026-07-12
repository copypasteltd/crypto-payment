import {
  loadWorkerRuntimeConfig,
} from "@lingban/config";
import {
  ApiConnector,
} from "@lingban/container-bridge";
import {
  bridgeEventSchema,
  startRunJobPayloadSchema,
  type BridgeEvent,
  type StartRunJobPayload,
} from "@lingban/contracts";
import { transitionRunStatus } from "@lingban/domain-models";
import {
  materializeRunRuntime,
} from "../services/container-runtime.js";
import {
  buildContainerBridgeSessionContext,
  buildHostBridgeSessionContext,
} from "../services/run-lifecycle.js";
import { startRunJobResultSchema } from "../services/specs.js";
import { materializeRunSessionPack } from "../services/session-pack-materializer.js";
import { prepareRunWorkspace } from "../services/workspace-preparer.js";

export async function startRunJob(payload: StartRunJobPayload) {
  const parsed = startRunJobPayloadSchema.parse(payload);
  const startedAt = new Date().toISOString();
  const readyRun = transitionRunStatus(parsed.run, "READY", {
    at: startedAt,
    reason: "worker completed preflight validation",
  });
  const queuedRun = transitionRunStatus(readyRun, "QUEUED", {
    at: startedAt,
    reason: "worker accepted the run into the launch queue",
  });

  const nextPayload = {
    ...parsed,
    run: queuedRun,
  };

  const preparedWorkspace = await prepareRunWorkspace({
    runId: parsed.run.runId,
    workspaceId: parsed.run.workspaceId,
    targetPath: parsed.run.targetPath,
  });
  const workerConfig = loadWorkerRuntimeConfig();
  const apiConnector = new ApiConnector({
    baseUrl: workerConfig.runtimeApiBaseUrl,
    authToken: workerConfig.internalAuthToken,
  });
  await materializeRunSessionPack({
    runId: parsed.run.runId,
    preparedWorkspace,
    apiConnector,
  });
  const hostBridgeContext = buildHostBridgeSessionContext(nextPayload, preparedWorkspace);
  const containerBridgeContext = buildContainerBridgeSessionContext(nextPayload, preparedWorkspace);
  const runtime = await materializeRunRuntime({
    payload: nextPayload,
    preparedWorkspace,
    hostBridgeContext,
    containerBridgeContext,
  });

  const events: BridgeEvent[] = [
    bridgeEventSchema.parse({
      type: "run.status.changed",
      runId: parsed.run.runId,
      status: "READY",
      occurredAt: startedAt,
      reason: "worker completed preflight validation",
    }),
    bridgeEventSchema.parse({
      type: "run.status.changed",
      runId: parsed.run.runId,
      status: "QUEUED",
      occurredAt: startedAt,
      reason: "worker accepted the run into the launch queue",
    }),
  ];

  return startRunJobResultSchema.parse({
    accepted: true,
    payload: nextPayload,
    events,
    preparedWorkspace,
    hostBridgeContext,
    containerBridgeContext,
    runtimeConfig: runtime.runtimeConfig,
    containerLaunchPlan: runtime.containerLaunchPlan,
  });
}
