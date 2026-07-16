import { randomUUID } from "node:crypto";
import {
  serviceSessionBindingSchema,
  type EntrySurface,
  type ServiceSessionBinding,
} from "@lingban/contracts";
import { nowIso } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { sessionAssetRepository } from "./repository.js";

const activeBindings = new Map<string, ServiceSessionBinding>();

function bindingKey(serviceId: string, workspaceContextKey: string, entrySurface: EntrySurface) {
  return `${serviceId}:${workspaceContextKey}:${entrySurface}`;
}

export async function initializeServiceSessionBindingRegistry() {
  activeBindings.clear();
  for (const binding of await sessionAssetRepository.listAllServiceBindings()) {
    if (binding.state !== "active") continue;
    const key = bindingKey(binding.serviceId, binding.workspaceContextKey, binding.entrySurface);
    const current = activeBindings.get(key);
    if (!current || current.updatedAt < binding.updatedAt) activeBindings.set(key, binding);
  }
}

export function getActiveServiceSessionBinding(
  serviceId: string,
  workspaceContextKey: string,
  entrySurface: EntrySurface
) {
  if (!getApiRuntimeConfig().creatorExplicitSessionBindingEnabled) return null;
  return activeBindings.get(bindingKey(serviceId, workspaceContextKey, entrySurface)) ?? null;
}

export async function activateServiceSessionBinding(input: {
  serviceId: string;
  workspaceContextKey: string;
  entrySurface: EntrySurface;
  taskVersionId: string;
  sessionVersionId: string;
}) {
  if (!getApiRuntimeConfig().creatorExplicitSessionBindingEnabled) {
    throw new AppError(
      503,
      "CREATOR_EXPLICIT_SESSION_BINDING_DISABLED",
      "Explicit service session binding is disabled"
    );
  }
  const version = await sessionAssetRepository.getVersion(input.sessionVersionId);
  if (version?.legacyIncomplete) {
    throw new AppError(
      409,
      "LEGACY_SESSION_REPLAY_REQUIRED",
      "Legacy-imported Session Versions require a captured revision and passed Replay Gate before service activation"
    );
  }
  const current = await sessionAssetRepository.getServiceBinding({
    serviceId: input.serviceId,
    workspaceContextKey: input.workspaceContextKey,
    entrySurface: input.entrySurface,
    state: "active",
  });
  if (
    current?.taskVersionId === input.taskVersionId &&
    current.sessionVersionId === input.sessionVersionId
  ) {
    activeBindings.set(bindingKey(input.serviceId, input.workspaceContextKey, input.entrySurface), current);
    return current;
  }

  const at = nowIso();
  const next = serviceSessionBindingSchema.parse({
    bindingId: `ssb_${randomUUID()}`,
    ...input,
    state: "active",
    version: (current?.version ?? 0) + 1,
    createdAt: at,
    updatedAt: at,
  });
  const saved = await sessionAssetRepository.putServiceBinding(next, current?.version ?? 0);
  if (!saved) {
    throw new AppError(
      409,
      "SERVICE_SESSION_BINDING_CONFLICT",
      `Service session binding changed concurrently: ${input.serviceId}/${input.workspaceContextKey}/${input.entrySurface}`
    );
  }
  activeBindings.set(bindingKey(saved.serviceId, saved.workspaceContextKey, saved.entrySurface), saved);
  return saved;
}
