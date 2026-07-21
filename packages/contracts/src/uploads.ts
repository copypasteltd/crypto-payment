import { z } from "./zod.js";
import {
  downloadTicketIdSchema,
  isoDatetimeSchema,
  runIdSchema,
  uploadIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { runConversationAttachmentSchema } from "./runs.js";

export const runUploadStatusSchema = z.enum(["created", "uploaded", "attached", "blocked", "expired"]);
export const runFileScanStatusSchema = z.enum(["pending", "clean", "blocked", "error", "skipped"]);
export const runDownloadSourceKindSchema = z.enum([
  "run-target-path",
  "uploaded-object",
  "object-store",
]);

export const runUploadRecordSchema = z.object({
  uploadId: uploadIdSchema,
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  fileName: z.string().min(1),
  contentType: z.string().min(1).nullable(),
  declaredSizeBytes: z.number().int().nonnegative().nullable(),
  storedSizeBytes: z.number().int().nonnegative().nullable(),
  sha256: z.string().length(64).nullable(),
  objectKey: z.string().min(1),
  status: runUploadStatusSchema,
  scanStatus: runFileScanStatusSchema.default("pending"),
  scanEngine: z.string().min(1).nullable().default(null),
  scanReasonCode: z.string().min(1).nullable().default(null),
  scanDetail: z.string().min(1).nullable().default(null),
  scanSignature: z.string().min(1).nullable().default(null),
  scannedAt: isoDatetimeSchema.nullable().default(null),
  attachedPath: z.string().min(1).nullable(),
  attachedLabel: z.string().min(1).nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const createRunUploadInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const createRunUploadResponseSchema = z.object({
  upload: runUploadRecordSchema,
  uploadUrl: z.string().min(1),
  method: z.literal("PUT"),
  maxBytes: z.number().int().positive(),
  contentType: z.literal("application/octet-stream"),
});

export const finalizeRunUploadInputSchema = z.object({
  label: z.string().min(1).max(255).optional(),
});

export const finalizeRunUploadResponseSchema = z.object({
  upload: runUploadRecordSchema,
  attachment: runConversationAttachmentSchema,
});

export const runDownloadTicketSchema = z.object({
  ticketId: downloadTicketIdSchema,
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  path: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sourceKind: runDownloadSourceKindSchema,
  objectKey: z.string().min(1).nullable(),
  uploadId: uploadIdSchema.nullable(),
  checksum: z.string().length(64).nullable().default(null),
  expiresAt: isoDatetimeSchema,
  createdAt: isoDatetimeSchema,
  createdByUserId: userIdSchema.nullable(),
});

export const createRunDownloadTicketInputSchema = z.object({
  path: z.string().min(1),
});

export const createRunDownloadTicketResponseSchema = z.object({
  ticket: runDownloadTicketSchema,
  downloadUrl: z.string().min(1),
});

export type RunUploadStatus = z.infer<typeof runUploadStatusSchema>;
export type RunFileScanStatus = z.infer<typeof runFileScanStatusSchema>;
export type RunUploadRecord = z.infer<typeof runUploadRecordSchema>;
export type CreateRunUploadInput = z.infer<typeof createRunUploadInputSchema>;
export type CreateRunUploadResponse = z.infer<typeof createRunUploadResponseSchema>;
export type FinalizeRunUploadInput = z.infer<typeof finalizeRunUploadInputSchema>;
export type FinalizeRunUploadResponse = z.infer<typeof finalizeRunUploadResponseSchema>;
export type RunDownloadSourceKind = z.infer<typeof runDownloadSourceKindSchema>;
export type RunDownloadTicket = z.infer<typeof runDownloadTicketSchema>;
export type CreateRunDownloadTicketInput = z.infer<typeof createRunDownloadTicketInputSchema>;
export type CreateRunDownloadTicketResponse = z.infer<typeof createRunDownloadTicketResponseSchema>;
