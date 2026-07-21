import { z } from "./zod.js";
import {
  isoDatetimeSchema,
  sessionIdSchema,
  userIdSchema,
  workspaceInvitationIdSchema,
  workspaceIdSchema,
} from "./common.js";
import {
  workspaceContextKeySchema,
  workspaceContextSummarySchema,
} from "./catalog.js";

export const workspaceTypeSchema = z.enum(["personal", "team", "enterprise"]);
export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "operator",
  "creator",
  "viewer",
]);
export const platformRoleSchema = z.enum(["platform_admin"]);
export const workspaceMembershipStatusSchema = z.enum(["active", "suspended"]);
export const workspaceInvitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const authUserSchema = z.object({
  userId: userIdSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const workspaceSchema = z.object({
  workspaceId: workspaceIdSchema,
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  type: workspaceTypeSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const workspaceMembershipSchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: userIdSchema,
  role: workspaceRoleSchema,
  status: workspaceMembershipStatusSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const workspaceSummarySchema = workspaceSchema.extend({
  contextKey: workspaceContextKeySchema,
  root: z.string().min(1),
  role: workspaceRoleSchema,
  membershipStatus: workspaceMembershipStatusSchema,
});

export const workspaceProfileMetricsSchema = z.object({
  visibleWorkshopsCount: z.number().int().nonnegative(),
  visibleServicesCount: z.number().int().nonnegative(),
  visibleRunsCount: z.number().int().nonnegative(),
  visiblePackagesCount: z.number().int().nonnegative(),
  pendingApprovalsCount: z.number().int().nonnegative(),
  recentAssetsCount: z.number().int().nonnegative(),
});

export const workspaceProfileSummarySchema = z.object({
  workspace: workspaceSummarySchema,
  metrics: workspaceProfileMetricsSchema,
  updatedAt: isoDatetimeSchema,
});

export const workspaceMemberRecordSchema = z.object({
  user: authUserSchema,
  membership: workspaceMembershipSchema,
});

export const workspaceInvitationRecordSchema = z.object({
  invitationId: workspaceInvitationIdSchema,
  workspaceId: workspaceIdSchema,
  email: z.string().email(),
  role: workspaceRoleSchema,
  status: workspaceInvitationStatusSchema,
  invitedByUserId: userIdSchema,
  acceptedByUserId: userIdSchema.nullable(),
  acceptTokenPreview: z.string().min(4).max(32).nullable(),
  note: z.string().min(1).max(500).nullable(),
  expiresAt: isoDatetimeSchema,
  acceptedAt: isoDatetimeSchema.nullable(),
  revokedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const workspaceInvitationViewSchema = z.object({
  invitation: workspaceInvitationRecordSchema,
  workspace: workspaceSchema,
  invitedBy: authUserSchema.nullable(),
});

export const authSessionSchema = z.object({
  sessionId: sessionIdSchema,
  userId: userIdSchema,
  currentWorkspaceId: workspaceIdSchema,
  accessTokenExpiresAt: isoDatetimeSchema,
  refreshTokenExpiresAt: isoDatetimeSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const authPlatformAccessSchema = z.object({
  isPlatformAdmin: z.boolean().default(false),
  role: platformRoleSchema.nullable().default(null),
});

export const authTokenPairSchema = z.object({
  tokenType: z.literal("Bearer"),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});

export const authSessionEnvelopeSchema = z.object({
  user: authUserSchema,
  session: authSessionSchema,
  currentWorkspace: workspaceSummarySchema,
  workspaces: z.array(workspaceSummarySchema),
  platformAccess: authPlatformAccessSchema.default({
    isPlatformAdmin: false,
    role: null,
  }),
});

export const authDisabledSessionBootstrapSchema = z.object({
  authMode: z.literal("disabled"),
  currentWorkspace: workspaceContextSummarySchema,
  workspaces: z.array(workspaceContextSummarySchema),
});

export const authSessionResponseSchema = authSessionEnvelopeSchema.extend({
  tokens: authTokenPairSchema,
});

export const registerAuthInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(200),
  displayName: z.string().min(1).max(120),
  workspaceName: z.string().min(1).max(120).optional(),
});

export const loginAuthInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const wechatMiniProgramLoginInputSchema = z.object({
  code: z.string().trim().min(1).max(256),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const refreshAuthInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutAuthInputSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const switchWorkspaceInputSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const createWorkspaceInvitationInputSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema,
  note: z.string().trim().min(1).max(500).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export const createWorkspaceInvitationResponseSchema = z.object({
  invitation: workspaceInvitationViewSchema,
  acceptToken: z.string().min(1),
});

export const updateWorkspaceMembershipInputSchema = z
  .object({
    role: workspaceRoleSchema.optional(),
    status: workspaceMembershipStatusSchema.optional(),
  })
  .refine((value) => value.role != null || value.status != null, {
    message: "At least one membership field must be updated",
  });

export const acceptWorkspaceInvitationInputSchema = z.object({
  acceptToken: z.string().min(1),
});

export const acceptWorkspaceInvitationResponseSchema = z.object({
  invitation: workspaceInvitationViewSchema,
  session: authSessionEnvelopeSchema,
});

export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type WorkspaceMembershipStatus = z.infer<typeof workspaceMembershipStatusSchema>;
export type WorkspaceInvitationStatus = z.infer<typeof workspaceInvitationStatusSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceProfileMetrics = z.infer<typeof workspaceProfileMetricsSchema>;
export type WorkspaceProfileSummary = z.infer<typeof workspaceProfileSummarySchema>;
export type WorkspaceMemberRecord = z.infer<typeof workspaceMemberRecordSchema>;
export type WorkspaceInvitationRecord = z.infer<typeof workspaceInvitationRecordSchema>;
export type WorkspaceInvitationView = z.infer<typeof workspaceInvitationViewSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthPlatformAccess = z.infer<typeof authPlatformAccessSchema>;
export type AuthTokenPair = z.infer<typeof authTokenPairSchema>;
export type AuthSessionEnvelope = z.infer<typeof authSessionEnvelopeSchema>;
export type AuthDisabledSessionBootstrap = z.infer<typeof authDisabledSessionBootstrapSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type RegisterAuthInput = z.infer<typeof registerAuthInputSchema>;
export type LoginAuthInput = z.infer<typeof loginAuthInputSchema>;
export type WechatMiniProgramLoginInput = z.infer<
  typeof wechatMiniProgramLoginInputSchema
>;
export type RefreshAuthInput = z.infer<typeof refreshAuthInputSchema>;
export type LogoutAuthInput = z.infer<typeof logoutAuthInputSchema>;
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceInputSchema>;
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationInputSchema>;
export type CreateWorkspaceInvitationResponse = z.infer<typeof createWorkspaceInvitationResponseSchema>;
export type UpdateWorkspaceMembershipInput = z.infer<typeof updateWorkspaceMembershipInputSchema>;
export type AcceptWorkspaceInvitationInput = z.infer<typeof acceptWorkspaceInvitationInputSchema>;
export type AcceptWorkspaceInvitationResponse = z.infer<typeof acceptWorkspaceInvitationResponseSchema>;
