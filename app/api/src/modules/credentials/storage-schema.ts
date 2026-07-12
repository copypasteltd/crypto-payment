import {
  credentialIdParamsSchema,
  credentialsStateSchema,
  storedCredentialRecordSchema,
  type CredentialsState,
  type StoredCredentialRecord,
} from "@lingban/db";
import { z } from "zod";
import {
  credentialAuditEventSchema,
  credentialBrokerKindSchema,
  credentialIdSchema,
  credentialStatusSchema,
  credentialMaterializationLeaseSchema,
} from "@lingban/contracts";
import { isoDatetimeSchema, runIdSchema, userIdSchema, workspaceIdSchema } from "@lingban/contracts";
export {
  credentialIdParamsSchema,
  credentialsStateSchema,
  storedCredentialRecordSchema,
  type CredentialsState,
  type StoredCredentialRecord,
} from "@lingban/db";

export const storedCredentialMaterializationLeaseSchema =
  credentialMaterializationLeaseSchema.extend({
    consumer: z.literal("run-worker").default("run-worker"),
    traceId: z.string().min(1).nullable().default(null),
  });

export const credentialMaterializationsStateSchema = z.object({
  leases: z.array(storedCredentialMaterializationLeaseSchema).default([]),
});

export const storedCredentialAuditEventSchema = credentialAuditEventSchema;

export const credentialAuditEventsStateSchema = z.object({
  events: z.array(storedCredentialAuditEventSchema).default([]),
});

export const credentialLifecycleCallbackDeliveryStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "exhausted",
]);

export const credentialLifecycleCallbackDeliverySchema = z.object({
  deliveryId: z.string().min(1),
  credentialId: credentialIdSchema,
  workspaceId: workspaceIdSchema,
  ownerUserId: userIdSchema.nullable().default(null),
  scope: z.enum(["user", "workspace"]),
  displayName: z.string().min(1).max(120),
  provider: z.string().min(1),
  secretKind: z.enum([
    "api-key",
    "access-token",
    "oauth-token",
    "json-file",
    "browser-storage-state",
    "session-cookie",
  ]),
  mountMode: z.enum(["env", "file"]),
  brokerKind: credentialBrokerKindSchema.nullable().default(null),
  activeKeyId: z.string().min(1).nullable().default(null),
  redactedSecretRef: z.string().min(1).nullable().default(null),
  callbackUrl: z.string().url(),
  callbackMethod: z.literal("POST"),
  targetStatus: z.union([z.literal("disabled"), z.literal("revoked")]),
  triggerAction: z.string().min(1),
  actorUserId: userIdSchema.nullable().default(null),
  runId: runIdSchema.nullable().default(null),
  traceId: z.string().min(1).nullable().default(null),
  statusBefore: credentialStatusSchema,
  statusAfter: credentialStatusSchema,
  secretVersion: z.number().int().positive(),
  status: credentialLifecycleCallbackDeliveryStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  nextAttemptAt: isoDatetimeSchema.nullable().default(null),
  lastAttemptAt: isoDatetimeSchema.nullable().default(null),
  completedAt: isoDatetimeSchema.nullable().default(null),
  lastHttpStatus: z.number().int().positive().nullable().default(null),
  lastErrorCode: z.string().min(1).nullable().default(null),
  lastErrorDetail: z.string().max(4000).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const credentialLifecycleCallbackDeliveriesStateSchema = z.object({
  deliveries: z.array(credentialLifecycleCallbackDeliverySchema).default([]),
});

export type StoredCredentialMaterializationLease = z.infer<
  typeof storedCredentialMaterializationLeaseSchema
>;
export type CredentialMaterializationsState = z.infer<
  typeof credentialMaterializationsStateSchema
>;
export type StoredCredentialAuditEvent = z.infer<
  typeof storedCredentialAuditEventSchema
>;
export type CredentialAuditEventsState = z.infer<
  typeof credentialAuditEventsStateSchema
>;
export type CredentialLifecycleCallbackDelivery = z.infer<
  typeof credentialLifecycleCallbackDeliverySchema
>;
export type CredentialLifecycleCallbackDeliveryStatus = z.infer<
  typeof credentialLifecycleCallbackDeliveryStatusSchema
>;
export type CredentialLifecycleCallbackDeliveriesState = z.infer<
  typeof credentialLifecycleCallbackDeliveriesStateSchema
>;
