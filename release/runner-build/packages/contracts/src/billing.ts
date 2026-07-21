import { z } from "./zod.js";
import { localizedTextSchema, serviceIdSchema, workspaceContextKeySchema } from "./catalog.js";
import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { quotaMetricSchema } from "./quota.js";

const billingEntryIdSchema = z.string().trim().min(1).max(160);
const creatorPackageIdSchema = z.string().trim().min(1).max(120);
const currencyCodeSchema = z.literal("USD");

export const billingSourceSchema = z.enum([
  "run-message",
  "run-upload",
  "file-read",
  "file-preview",
  "download-ticket",
  "file-download",
  "mcp-call",
  "audit-export",
  "runtime-estimate",
]);

export const billingCostBasisSchema = z.enum(["estimated", "actual"]);

export const billingEntrySchema = z.object({
  entryId: billingEntryIdSchema,
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  packageId: creatorPackageIdSchema.nullable().default(null),
  serviceId: serviceIdSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema.nullable().default(null),
  sessionVersionId: sessionVersionIdSchema.nullable().default(null),
  entrySurface: entrySurfaceSchema.nullable().default(null),
  runId: runIdSchema.nullable().default(null),
  requestedByUserId: userIdSchema.nullable().default(null),
  metric: quotaMetricSchema,
  quantity: z.number().nonnegative(),
  unitPriceUsd: z.number().nonnegative(),
  amountUsd: z.number().nonnegative(),
  currency: currencyCodeSchema.default("USD"),
  source: billingSourceSchema,
  costBasis: billingCostBasisSchema.default("estimated"),
  sourceRef: z.string().trim().min(1).max(240).nullable().default(null),
  note: z.string().trim().min(1).max(2000).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  occurredAt: isoDatetimeSchema,
});

export const billingMetricSummarySchema = z.object({
  metric: quotaMetricSchema,
  quantity: z.number().nonnegative(),
  amountUsd: z.number().nonnegative(),
  entriesCount: z.number().int().nonnegative(),
  currency: currencyCodeSchema.default("USD"),
  latestOccurredAt: isoDatetimeSchema.nullable().default(null),
  label: localizedTextSchema,
});

export const billingLedgerSummarySchema = z.object({
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  packageId: creatorPackageIdSchema.nullable().default(null),
  serviceId: serviceIdSchema.nullable().default(null),
  runId: runIdSchema.nullable().default(null),
  currency: currencyCodeSchema.default("USD"),
  totalAmountUsd: z.number().nonnegative(),
  totalEntriesCount: z.number().int().nonnegative(),
  metrics: z.array(billingMetricSummarySchema).default([]),
  updatedAt: isoDatetimeSchema.nullable().default(null),
});

export const listBillingEntriesQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  packageId: creatorPackageIdSchema.optional(),
  serviceId: serviceIdSchema.optional(),
  metric: quotaMetricSchema.optional(),
  source: billingSourceSchema.optional(),
  costBasis: billingCostBasisSchema.optional(),
  runId: runIdSchema.optional(),
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const billingLedgerSummaryQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  packageId: creatorPackageIdSchema.optional(),
  serviceId: serviceIdSchema.optional(),
  runId: runIdSchema.optional(),
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
});

export type BillingSource = z.infer<typeof billingSourceSchema>;
export type BillingCostBasis = z.infer<typeof billingCostBasisSchema>;
export type BillingEntry = z.infer<typeof billingEntrySchema>;
export type BillingMetricSummary = z.infer<typeof billingMetricSummarySchema>;
export type BillingLedgerSummary = z.infer<typeof billingLedgerSummarySchema>;
export type ListBillingEntriesQuery = z.infer<typeof listBillingEntriesQuerySchema>;
export type BillingLedgerSummaryQuery = z.infer<typeof billingLedgerSummaryQuerySchema>;
