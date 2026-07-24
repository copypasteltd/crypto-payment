import { z } from "./zod.js";
import {
  conversationShareAccessIdSchema,
  conversationShareIdSchema,
  isoDatetimeSchema,
  messageKindSchema,
  messageRoleSchema,
  runIdSchema,
  sessionCaptureIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";

export const conversationShareSourceTypeSchema = z.enum(["run", "session_capture"]);
export const conversationShareAccessScopeSchema = z.enum([
  "public_link",
  "workspace",
  "invited_users",
]);
export const conversationShareStatusSchema = z.enum(["active", "expired", "revoked"]);
export const conversationShareFileKindSchema = z.enum(["image", "video", "file"]);

export const createConversationShareInputSchema = z
  .object({
    sourceType: conversationShareSourceTypeSchema.default("run"),
    captureId: sessionCaptureIdSchema.nullable().default(null),
    title: z.string().trim().min(1).max(120),
    accessScope: conversationShareAccessScopeSchema.default("public_link"),
    invitedUserIds: z.array(userIdSchema).max(200).default([]),
    expiresAt: isoDatetimeSchema.nullable().default(null),
    includeSystemMessages: z.boolean().default(true),
    includeAttachments: z.boolean().default(true),
    idempotencyKey: z.string().trim().min(8).max(240),
  })
  .superRefine((value, ctx) => {
    if (value.sourceType === "session_capture" && !value.captureId) {
      ctx.addIssue({
        code: "custom",
        path: ["captureId"],
        message: "captureId is required for a session_capture share",
      });
    }
    if (value.sourceType === "run" && value.captureId) {
      ctx.addIssue({
        code: "custom",
        path: ["captureId"],
        message: "captureId must be null for a run share",
      });
    }
    if (value.accessScope === "invited_users" && value.invitedUserIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["invitedUserIds"],
        message: "At least one invited user is required",
      });
    }
  });

export const conversationShareFileSchema = z.object({
  fileId: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(240),
  kind: conversationShareFileKindSchema,
  mimeType: z.string().trim().min(1).max(240).nullable().default(null),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
  available: z.boolean(),
  contentPath: z.string().trim().min(1).max(1024).nullable().default(null),
});

export const conversationShareMessageSchema = z.object({
  messageId: z.string().trim().min(1).max(240),
  role: messageRoleSchema,
  kind: messageKindSchema,
  text: z.string().max(1_000_000),
  fileIds: z.array(z.string().trim().min(1).max(120)).default([]),
  createdAt: isoDatetimeSchema,
});

export const conversationShareSummarySchema = z.object({
  shareId: conversationShareIdSchema,
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  sourceType: conversationShareSourceTypeSchema,
  captureId: sessionCaptureIdSchema.nullable().default(null),
  title: z.string().trim().min(1).max(120),
  accessScope: conversationShareAccessScopeSchema,
  invitedUserIds: z.array(userIdSchema).default([]),
  status: conversationShareStatusSchema,
  includeSystemMessages: z.boolean(),
  includeAttachments: z.boolean(),
  boundaryMessageId: z.string().trim().min(1).max(240).nullable().default(null),
  boundaryTurnId: z.string().trim().min(1).max(240).nullable().default(null),
  messageCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  createdByUserId: userIdSchema.nullable().default(null),
  publicPath: z.string().trim().min(1).max(1024),
  createdAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema.nullable().default(null),
  revokedAt: isoDatetimeSchema.nullable().default(null),
});

export const conversationShareViewSchema = z.object({
  share: conversationShareSummarySchema,
  messages: z.array(conversationShareMessageSchema),
  files: z.array(conversationShareFileSchema),
});

export const conversationSharePublicSummarySchema = conversationShareSummarySchema.omit({
  runId: true,
  workspaceId: true,
  captureId: true,
  invitedUserIds: true,
  boundaryMessageId: true,
  boundaryTurnId: true,
  createdByUserId: true,
});

export const conversationSharePublicViewSchema = z.object({
  share: conversationSharePublicSummarySchema,
  messages: z.array(conversationShareMessageSchema),
  files: z.array(conversationShareFileSchema),
});

export const createConversationShareResponseSchema = z.object({
  share: conversationShareSummarySchema,
  view: conversationShareViewSchema,
});

export const listConversationSharesResponseSchema = z.object({
  items: z.array(conversationShareSummarySchema),
});

export const conversationShareAccessRecordSchema = z.object({
  accessId: conversationShareAccessIdSchema,
  shareId: conversationShareIdSchema,
  accessType: z.enum(["view", "file"]),
  fileId: z.string().trim().min(1).max(120).nullable().default(null),
  actorUserId: userIdSchema.nullable().default(null),
  viewerType: z.enum(["anonymous", "authenticated"]),
  clientFingerprint: z.string().regex(/^[a-f0-9]{64}$/i).nullable().default(null),
  accessedAt: isoDatetimeSchema,
});

export const listConversationShareAccessResponseSchema = z.object({
  items: z.array(conversationShareAccessRecordSchema),
});

export type ConversationShareSourceType = z.infer<typeof conversationShareSourceTypeSchema>;
export type ConversationShareAccessScope = z.infer<typeof conversationShareAccessScopeSchema>;
export type ConversationShareStatus = z.infer<typeof conversationShareStatusSchema>;
export type ConversationShareFileKind = z.infer<typeof conversationShareFileKindSchema>;
export type CreateConversationShareInput = z.infer<typeof createConversationShareInputSchema>;
export type ConversationShareFile = z.infer<typeof conversationShareFileSchema>;
export type ConversationShareMessage = z.infer<typeof conversationShareMessageSchema>;
export type ConversationShareSummary = z.infer<typeof conversationShareSummarySchema>;
export type ConversationShareView = z.infer<typeof conversationShareViewSchema>;
export type ConversationSharePublicSummary = z.infer<
  typeof conversationSharePublicSummarySchema
>;
export type ConversationSharePublicView = z.infer<typeof conversationSharePublicViewSchema>;
export type CreateConversationShareResponse = z.infer<typeof createConversationShareResponseSchema>;
export type ListConversationSharesResponse = z.infer<typeof listConversationSharesResponseSchema>;
export type ConversationShareAccessRecord = z.infer<typeof conversationShareAccessRecordSchema>;
export type ListConversationShareAccessResponse = z.infer<
  typeof listConversationShareAccessResponseSchema
>;
