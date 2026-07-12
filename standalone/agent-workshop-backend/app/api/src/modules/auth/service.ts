import { randomUUID } from "node:crypto";
import type {
  AcceptWorkspaceInvitationInput,
  AcceptWorkspaceInvitationResponse,
  AuthSessionEnvelope,
  AuthSessionResponse,
  AuthTokenPair,
  AuthUser,
  CreateWorkspaceInvitationInput,
  CreateWorkspaceInvitationResponse,
  LoginAuthInput,
  RefreshAuthInput,
  RegisterAuthInput,
  SwitchWorkspaceInput,
  Workspace,
  WorkspaceInvitationRecord,
  WorkspaceInvitationView,
  WorkspaceMembership,
  WorkspaceMemberRecord,
  WorkspaceRole,
  WorkspaceProfileSummary,
  WorkspaceSummary,
  UpdateWorkspaceMembershipInput,
} from "@lingban/contracts";
import {
  acceptWorkspaceInvitationInputSchema,
  acceptWorkspaceInvitationResponseSchema,
  authSessionEnvelopeSchema,
  authSessionResponseSchema,
  createWorkspaceInvitationInputSchema,
  createWorkspaceInvitationResponseSchema,
  loginAuthInputSchema,
  refreshAuthInputSchema,
  registerAuthInputSchema,
  switchWorkspaceInputSchema,
  workspaceInvitationViewSchema,
  workspaceMemberRecordSchema,
  workspaceProfileSummarySchema,
  updateWorkspaceMembershipInputSchema,
} from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { AppError } from "../../app/errors.js";
import { authRepository } from "./repository.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "./crypto.js";
import type {
  AuthSessionRecord,
  AuthUserRecord,
  AuthWorkspaceInvitationRecord,
} from "./storage-schema.js";
import { workshopCatalogRepository } from "../workshops/repository.js";
import { creatorRepository } from "../creator/repository.js";
import { runsRepository } from "../runs/repository.js";

type AuthContext = {
  user: AuthUser;
  session: AuthSessionRecord;
  currentWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
};

let userSequence = 1;
let workspaceSequence = 1;
let sessionSequence = 1;
let invitationSequence = 1;
let bootstrapped = false;

function nowIso() {
  return new Date().toISOString();
}

function parseCounter(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const suffix = value.slice(prefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bootstrapSequences() {
  let maxUser = 0;
  let maxWorkspace = 0;
  let maxSession = 0;
  let maxInvitation = 0;

  for (const user of authRepository.listUsers()) {
    maxUser = Math.max(maxUser, parseCounter(user.userId, "usr_"));
  }

  for (const workspace of authRepository.listWorkspaces()) {
    maxWorkspace = Math.max(maxWorkspace, parseCounter(workspace.workspaceId, "wsp_"));
  }

  for (const session of authRepository.listSessions()) {
    maxSession = Math.max(maxSession, parseCounter(session.sessionId, "ses_"));
  }

  for (const invitation of authRepository.listInvitations()) {
    maxInvitation = Math.max(maxInvitation, parseCounter(invitation.invitationId, "wiv_"));
  }

  userSequence = Math.max(userSequence, maxUser + 1);
  workspaceSequence = Math.max(workspaceSequence, maxWorkspace + 1);
  sessionSequence = Math.max(sessionSequence, maxSession + 1);
  invitationSequence = Math.max(invitationSequence, maxInvitation + 1);
  bootstrapped = true;
}

function ensureSequencesBootstrapped() {
  if (bootstrapped) {
    return;
  }

  bootstrapSequences();
}

function nextUserId() {
  ensureSequencesBootstrapped();
  return `usr_${String(userSequence++).padStart(8, "0")}`;
}

function nextWorkspaceId() {
  ensureSequencesBootstrapped();
  return `wsp_${String(workspaceSequence++).padStart(8, "0")}`;
}

function nextSessionId() {
  ensureSequencesBootstrapped();
  return `ses_${String(sessionSequence++).padStart(8, "0")}`;
}

function nextInvitationId() {
  ensureSequencesBootstrapped();
  return `wiv_${String(invitationSequence++).padStart(8, "0")}`;
}

function slugify(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `workspace-${randomUUID().slice(0, 8)}`;
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeKeySegment(value?: string | null) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferWorkspaceContextKey(workspace: Workspace) {
  const type = normalizeText(workspace.type);
  const haystack = [
    normalizeText(workspace.workspaceId),
    normalizeText(workspace.slug),
    normalizeText(workspace.name),
  ].join(" ");

  if (type === "personal" || haystack.includes("personal") || /个人/.test(haystack)) {
    return "personal";
  }

  if (/harbor|finance|tax|filing|财务|财税|报税/.test(haystack)) {
    return "harbor-finance";
  }

  if (/brand|content|poster|drama|creator|品牌|内容|海报|短剧/.test(haystack)) {
    return "brand-lab";
  }

  return normalizeKeySegment(workspace.slug) || normalizeKeySegment(workspace.name) || workspace.workspaceId;
}

function resolveWorkspaceRoot(workspace: Workspace, catalogRoot?: string | null) {
  if (typeof catalogRoot === "string" && catalogRoot.trim().length > 0) {
    return catalogRoot;
  }

  const normalizedSlug =
    normalizeKeySegment(workspace.slug) ||
    normalizeKeySegment(workspace.name) ||
    workspace.workspaceId;
  return `/workspace/${normalizedSlug}/`;
}

function buildWorkspaceSummary(workspace: Workspace, membership: WorkspaceMembership): WorkspaceSummary {
  const catalogContext = workshopCatalogRepository.getContextByRuntimeWorkspaceId(workspace.workspaceId);
  const contextKey = catalogContext?.contextKey ?? inferWorkspaceContextKey(workspace);
  const root = resolveWorkspaceRoot(workspace, catalogContext?.root ?? null);

  return {
    ...workspace,
    contextKey,
    root,
    role: membership.role,
    membershipStatus: membership.status,
  };
}

function isDirectoryPath(value: string) {
  return value.endsWith("/") || value.endsWith("\\");
}

function toPublicUser(user: AuthUserRecord): AuthUser {
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildTokenExpiry(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function isExpired(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

function ensureActiveMembership(membership: WorkspaceMembership | null, workspaceId: string, userId: string) {
  if (!membership || membership.status !== "active") {
    throw new AppError(403, "WORKSPACE_ACCESS_DENIED", `User ${userId} cannot access workspace ${workspaceId}`);
  }

  return membership;
}

function workspaceRoleRank(role: WorkspaceRole) {
  switch (role) {
    case "viewer":
      return 0;
    case "operator":
      return 1;
    case "creator":
      return 2;
    case "admin":
      return 3;
    case "owner":
      return 4;
    default:
      return 0;
  }
}

function canManageWorkspaceMembers(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function allowedManagedRoles(role: WorkspaceRole): WorkspaceRole[] {
  return role === "owner"
    ? ["admin", "creator", "operator", "viewer"]
    : ["creator", "operator", "viewer"];
}

function resolveEffectiveInvitationStatus(record: AuthWorkspaceInvitationRecord): WorkspaceInvitationRecord["status"] {
  if (record.status === "pending" && isExpired(record.expiresAt)) {
    return "expired";
  }

  return record.status;
}

function toPublicInvitationRecord(record: AuthWorkspaceInvitationRecord): WorkspaceInvitationRecord {
  const { acceptTokenHash: _acceptTokenHash, ...rest } = record;
  return {
    ...rest,
    status: resolveEffectiveInvitationStatus(record),
  };
}

async function createSessionRecord(input: {
  user: AuthUserRecord;
  currentWorkspace: Workspace;
}) {
  const config = getApiRuntimeConfig();
  const createdAt = nowIso();
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();

  const record: AuthSessionRecord = {
    sessionId: nextSessionId(),
    userId: input.user.userId,
    currentWorkspaceId: input.currentWorkspace.workspaceId,
    accessTokenHash: hashOpaqueToken(accessToken),
    refreshTokenHash: hashOpaqueToken(refreshToken),
    accessTokenExpiresAt: buildTokenExpiry(config.authAccessTokenTtlSeconds),
    refreshTokenExpiresAt: buildTokenExpiry(config.authRefreshTokenTtlSeconds),
    revokedAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  await authRepository.createSession(record);

  const tokens: AuthTokenPair = {
    tokenType: "Bearer",
    accessToken,
    refreshToken,
    expiresInSeconds: config.authAccessTokenTtlSeconds,
  };

  return {
    record,
    tokens,
  };
}

async function rotateSessionTokens(record: AuthSessionRecord, currentWorkspaceId?: string) {
  const config = getApiRuntimeConfig();
  const updatedAt = nowIso();
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();

  const nextRecord: AuthSessionRecord = {
    ...record,
    currentWorkspaceId: currentWorkspaceId ?? record.currentWorkspaceId,
    accessTokenHash: hashOpaqueToken(accessToken),
    refreshTokenHash: hashOpaqueToken(refreshToken),
    accessTokenExpiresAt: buildTokenExpiry(config.authAccessTokenTtlSeconds),
    refreshTokenExpiresAt: buildTokenExpiry(config.authRefreshTokenTtlSeconds),
    updatedAt,
  };

  await authRepository.updateSession(nextRecord);

  return {
    record: nextRecord,
    tokens: {
      tokenType: "Bearer" as const,
      accessToken,
      refreshToken,
      expiresInSeconds: config.authAccessTokenTtlSeconds,
    },
  };
}

export class AuthService {
  async register(input: RegisterAuthInput): Promise<AuthSessionResponse> {
    const parsed = registerAuthInputSchema.parse(input);
    const email = normalizeEmail(parsed.email);

    if (authRepository.findUserByEmail(email)) {
      throw new AppError(409, "AUTH_EMAIL_EXISTS", `Email already exists: ${email}`);
    }

    const createdAt = nowIso();
    const user: AuthUserRecord = {
      userId: nextUserId(),
      email,
      displayName: parsed.displayName.trim(),
      passwordHash: hashPassword(parsed.password),
      createdAt,
      updatedAt: createdAt,
    };
    const workspace: Workspace = {
      workspaceId: nextWorkspaceId(),
      slug: slugify(parsed.workspaceName ?? `${parsed.displayName}-workspace`),
      name: (parsed.workspaceName ?? `${parsed.displayName} Workspace`).trim(),
      type: "personal",
      createdAt,
      updatedAt: createdAt,
    };
    const membership: WorkspaceMembership = {
      workspaceId: workspace.workspaceId,
      userId: user.userId,
      role: "owner",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    };

    await authRepository.createUser(user);
    await authRepository.createWorkspace(workspace);
    await authRepository.addMembership(membership);

    const session = await createSessionRecord({
      user,
      currentWorkspace: workspace,
    });

    return this.#buildSessionResponse(user, session.record, session.tokens);
  }

  async login(input: LoginAuthInput): Promise<AuthSessionResponse> {
    const parsed = loginAuthInputSchema.parse(input);
    const user = authRepository.findUserByEmail(normalizeEmail(parsed.email));

    if (!user || !verifyPassword(parsed.password, user.passwordHash)) {
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Invalid email or password");
    }

    const memberships = authRepository.listMembershipsByUser(user.userId);
    const primary = memberships.find((item) => item.membership.status === "active");

    if (!primary) {
      throw new AppError(403, "WORKSPACE_ACCESS_DENIED", `No active workspace for user ${user.userId}`);
    }

    const session = await createSessionRecord({
      user,
      currentWorkspace: primary.workspace,
    });

    return this.#buildSessionResponse(user, session.record, session.tokens);
  }

  async refresh(input: RefreshAuthInput): Promise<AuthSessionResponse> {
    const parsed = refreshAuthInputSchema.parse(input);
    const record = authRepository.findSessionByRefreshTokenHash(hashOpaqueToken(parsed.refreshToken));

    if (!record || record.revokedAt || isExpired(record.refreshTokenExpiresAt)) {
      throw new AppError(401, "AUTH_REFRESH_INVALID", "Refresh token is invalid or expired");
    }

    const user = authRepository.getUserById(record.userId);
    if (!user) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session user not found: ${record.userId}`);
    }

    const rotated = await rotateSessionTokens(record);
    return this.#buildSessionResponse(user, rotated.record, rotated.tokens);
  }

  async logout(sessionId: string, refreshToken?: string) {
    const record =
      refreshToken != null
        ? authRepository.findSessionByRefreshTokenHash(hashOpaqueToken(refreshToken))
        : authRepository.getSessionById(sessionId);

    if (!record) {
      return { ok: true };
    }

    await authRepository.updateSession({
      ...record,
      revokedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { ok: true };
  }

  authenticateAccessToken(accessToken: string): AuthContext {
    const record = authRepository.findSessionByAccessTokenHash(hashOpaqueToken(accessToken));

    if (!record || record.revokedAt || isExpired(record.accessTokenExpiresAt)) {
      throw new AppError(401, "AUTH_ACCESS_INVALID", "Access token is invalid or expired");
    }

    return this.#buildSessionEnvelopeFromRecord(record);
  }

  getSessionEnvelope(sessionId: string): AuthSessionEnvelope {
    const record = authRepository.getSessionById(sessionId);

    if (!record || record.revokedAt) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session not found: ${sessionId}`);
    }

    return this.#buildSessionEnvelopeFromRecord(record);
  }

  getWorkspaceProfileSummary(userId: string, workspaceId: string): WorkspaceProfileSummary {
    const workspace = authRepository.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", `Workspace not found: ${workspaceId}`);
    }

    const membership = ensureActiveMembership(
      authRepository.getMembership(workspaceId, userId),
      workspaceId,
      userId
    );
    const summary = buildWorkspaceSummary(workspace, membership);

    return this.#buildWorkspaceProfileSummary(summary);
  }

  listWorkspaceMembers(userId: string, workspaceId: string): WorkspaceMemberRecord[] {
    const workspace = authRepository.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", `Workspace not found: ${workspaceId}`);
    }

    ensureActiveMembership(authRepository.getMembership(workspaceId, userId), workspaceId, userId);

    return authRepository
      .listMembershipsByWorkspace(workspaceId)
      .sort(
        (left, right) =>
          workspaceRoleRank(right.membership.role) - workspaceRoleRank(left.membership.role) ||
          left.user.createdAt.localeCompare(right.user.createdAt) ||
          left.user.userId.localeCompare(right.user.userId)
      )
      .map((item) =>
        workspaceMemberRecordSchema.parse({
          user: toPublicUser(item.user),
          membership: item.membership,
        })
      );
  }

  listWorkspaceInvitations(userId: string, workspaceId: string): WorkspaceInvitationView[] {
    const adminContext = this.#requireWorkspaceAdmin(userId, workspaceId);
    void adminContext;

    return authRepository
      .listInvitationsByWorkspace(workspaceId)
      .map((record) => this.#buildInvitationView(record));
  }

  listMyInvitations(userId: string): WorkspaceInvitationView[] {
    const user = authRepository.getUserById(userId);
    if (!user) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session user not found: ${userId}`);
    }

    return authRepository
      .listInvitationsByEmail(user.email)
      .map((record) => this.#buildInvitationView(record));
  }

  async inviteWorkspaceMember(
    requesterUserId: string,
    workspaceId: string,
    input: CreateWorkspaceInvitationInput
  ): Promise<CreateWorkspaceInvitationResponse> {
    const parsed = createWorkspaceInvitationInputSchema.parse(input);
    const { membership: requesterMembership } = this.#requireWorkspaceAdmin(requesterUserId, workspaceId);

    if (!allowedManagedRoles(requesterMembership.role).includes(parsed.role)) {
      throw new AppError(
        403,
        "WORKSPACE_ROLE_FORBIDDEN",
        `Workspace role ${requesterMembership.role} cannot invite role ${parsed.role}`
      );
    }

    const normalizedEmail = normalizeEmail(parsed.email);
    const existingUser = authRepository.findUserByEmail(normalizedEmail);
    const existingMembership = existingUser
      ? authRepository.getMembership(workspaceId, existingUser.userId)
      : null;

    if (existingMembership?.status === "active") {
      throw new AppError(
        409,
        "WORKSPACE_MEMBER_EXISTS",
        `User ${normalizedEmail} is already an active member of workspace ${workspaceId}`
      );
    }

    const now = nowIso();
    const acceptToken = generateOpaqueToken();
    const reusableInvitation = authRepository
      .listInvitationsByWorkspace(workspaceId)
      .find(
        (record) =>
          record.email === normalizedEmail &&
          resolveEffectiveInvitationStatus(record) !== "accepted"
      );

    const record: AuthWorkspaceInvitationRecord = {
      invitationId: reusableInvitation?.invitationId ?? nextInvitationId(),
      workspaceId,
      email: normalizedEmail,
      role: parsed.role,
      status: "pending",
      invitedByUserId: requesterUserId,
      acceptedByUserId: null,
      acceptTokenHash: hashOpaqueToken(acceptToken),
      acceptTokenPreview: acceptToken.slice(0, 8),
      note: parsed.note?.trim() || null,
      expiresAt: new Date(
        Date.now() + (parsed.expiresInDays ?? 7) * 24 * 60 * 60 * 1000
      ).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      createdAt: reusableInvitation?.createdAt ?? now,
      updatedAt: now,
    };

    await authRepository.saveInvitation(record);

    return createWorkspaceInvitationResponseSchema.parse({
      invitation: this.#buildInvitationView(record),
      acceptToken,
    });
  }

  async updateWorkspaceMembership(
    requesterUserId: string,
    workspaceId: string,
    memberUserId: string,
    input: UpdateWorkspaceMembershipInput
  ): Promise<WorkspaceMemberRecord> {
    const parsed = updateWorkspaceMembershipInputSchema.parse(input);
    const { membership: requesterMembership } = this.#requireWorkspaceAdmin(requesterUserId, workspaceId);

    if (memberUserId === requesterUserId) {
      throw new AppError(
        409,
        "WORKSPACE_SELF_MUTATION_FORBIDDEN",
        "Use a different workspace administrator to change your own membership"
      );
    }

    const targetMembership = authRepository.getMembership(workspaceId, memberUserId);
    if (!targetMembership) {
      throw new AppError(
        404,
        "WORKSPACE_MEMBER_NOT_FOUND",
        `Workspace member not found: ${memberUserId}`
      );
    }

    if (targetMembership.role === "owner") {
      throw new AppError(
        403,
        "WORKSPACE_OWNER_IMMUTABLE",
        "Owner memberships cannot be changed through this endpoint"
      );
    }

    if (
      requesterMembership.role === "admin" &&
      targetMembership.role === "admin"
    ) {
      throw new AppError(
        403,
        "WORKSPACE_ROLE_FORBIDDEN",
        "Admins cannot modify admin or owner memberships"
      );
    }

    if (
      parsed.role &&
      !allowedManagedRoles(requesterMembership.role).includes(parsed.role)
    ) {
      throw new AppError(
        403,
        "WORKSPACE_ROLE_FORBIDDEN",
        `Workspace role ${requesterMembership.role} cannot assign role ${parsed.role}`
      );
    }

    const nextMembership: WorkspaceMembership = {
      ...targetMembership,
      role: parsed.role ?? targetMembership.role,
      status: parsed.status ?? targetMembership.status,
      updatedAt: nowIso(),
    };

    await authRepository.addMembership(nextMembership);
    const user = authRepository.getUserById(memberUserId);
    if (!user) {
      throw new AppError(404, "AUTH_USER_NOT_FOUND", `User not found: ${memberUserId}`);
    }

    return workspaceMemberRecordSchema.parse({
      user: toPublicUser(user),
      membership: nextMembership,
    });
  }

  async revokeWorkspaceInvitation(
    requesterUserId: string,
    workspaceId: string,
    invitationId: string
  ): Promise<WorkspaceInvitationView> {
    this.#requireWorkspaceAdmin(requesterUserId, workspaceId);
    const invitation = authRepository.getInvitationById(invitationId);

    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw new AppError(
        404,
        "WORKSPACE_INVITATION_NOT_FOUND",
        `Workspace invitation not found: ${invitationId}`
      );
    }

    const effectiveStatus = resolveEffectiveInvitationStatus(invitation);
    if (effectiveStatus === "accepted") {
      throw new AppError(
        409,
        "WORKSPACE_INVITATION_ACCEPTED",
        `Workspace invitation ${invitationId} has already been accepted`
      );
    }

    const nextRecord: AuthWorkspaceInvitationRecord = {
      ...invitation,
      status: "revoked",
      revokedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await authRepository.saveInvitation(nextRecord);
    return this.#buildInvitationView(nextRecord);
  }

  async acceptWorkspaceInvitation(
    sessionId: string,
    userId: string,
    invitationId: string,
    input: AcceptWorkspaceInvitationInput
  ): Promise<AcceptWorkspaceInvitationResponse> {
    const parsed = acceptWorkspaceInvitationInputSchema.parse(input);
    const invitation = authRepository.getInvitationById(invitationId);

    if (!invitation) {
      throw new AppError(
        404,
        "WORKSPACE_INVITATION_NOT_FOUND",
        `Workspace invitation not found: ${invitationId}`
      );
    }

    const effectiveStatus = resolveEffectiveInvitationStatus(invitation);
    if (effectiveStatus === "expired") {
      throw new AppError(
        410,
        "WORKSPACE_INVITATION_EXPIRED",
        `Workspace invitation ${invitationId} has expired`
      );
    }

    if (effectiveStatus !== "pending") {
      throw new AppError(
        409,
        "WORKSPACE_INVITATION_NOT_PENDING",
        `Workspace invitation ${invitationId} is not pending`
      );
    }

    if (hashOpaqueToken(parsed.acceptToken) !== invitation.acceptTokenHash) {
      throw new AppError(401, "WORKSPACE_INVITATION_TOKEN_INVALID", "Invitation token is invalid");
    }

    const user = authRepository.getUserById(userId);
    if (!user) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session user not found: ${userId}`);
    }

    if (normalizeEmail(user.email) !== invitation.email) {
      throw new AppError(
        403,
        "WORKSPACE_INVITATION_EMAIL_MISMATCH",
        "Invitation email does not match the current account"
      );
    }

    const workspace = authRepository.getWorkspaceById(invitation.workspaceId);
    if (!workspace) {
      throw new AppError(
        404,
        "WORKSPACE_NOT_FOUND",
        `Workspace not found: ${invitation.workspaceId}`
      );
    }

    const currentMembership = authRepository.getMembership(invitation.workspaceId, userId);
    const now = nowIso();
    await authRepository.addMembership({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
      status: "active",
      createdAt: currentMembership?.createdAt ?? now,
      updatedAt: now,
    });

    const acceptedInvitation: AuthWorkspaceInvitationRecord = {
      ...invitation,
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: now,
      updatedAt: now,
    };
    await authRepository.saveInvitation(acceptedInvitation);

    return acceptWorkspaceInvitationResponseSchema.parse({
      invitation: this.#buildInvitationView(acceptedInvitation),
      session: this.getSessionEnvelope(sessionId),
    });
  }

  async switchWorkspace(sessionId: string, input: SwitchWorkspaceInput): Promise<AuthSessionResponse> {
    const parsed = switchWorkspaceInputSchema.parse(input);
    const record = authRepository.getSessionById(sessionId);

    if (!record || record.revokedAt) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session not found: ${sessionId}`);
    }

    const membership = ensureActiveMembership(
      authRepository.getMembership(parsed.workspaceId, record.userId),
      parsed.workspaceId,
      record.userId
    );
    void membership;

    const user = authRepository.getUserById(record.userId);
    if (!user) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session user not found: ${record.userId}`);
    }

    const rotated = await rotateSessionTokens(record, parsed.workspaceId);
    return this.#buildSessionResponse(user, rotated.record, rotated.tokens);
  }

  #buildSessionEnvelopeFromRecord(record: AuthSessionRecord): AuthContext {
    const user = authRepository.getUserById(record.userId);

    if (!user) {
      throw new AppError(401, "AUTH_SESSION_INVALID", `Session user not found: ${record.userId}`);
    }

    const memberships = authRepository.listMembershipsByUser(user.userId);
    const currentMembership = ensureActiveMembership(
      authRepository.getMembership(record.currentWorkspaceId, user.userId),
      record.currentWorkspaceId,
      user.userId
    );
    const currentWorkspace = authRepository.getWorkspaceById(record.currentWorkspaceId);

    if (!currentWorkspace) {
      throw new AppError(
        401,
        "WORKSPACE_NOT_FOUND",
        `Workspace not found: ${record.currentWorkspaceId}`
      );
    }

    return {
      user: toPublicUser(user),
      session: record,
      currentWorkspace: buildWorkspaceSummary(currentWorkspace, currentMembership),
      workspaces: memberships
        .filter((item) => item.membership.status === "active")
        .map((item) => buildWorkspaceSummary(item.workspace, item.membership)),
    };
  }

  #buildSessionResponse(
    user: AuthUserRecord,
    session: AuthSessionRecord,
    tokens: AuthTokenPair
  ): AuthSessionResponse {
    const envelope = this.#buildSessionEnvelopeFromRecord(session);
    return authSessionResponseSchema.parse({
      user: toPublicUser(user),
      session,
      currentWorkspace: envelope.currentWorkspace,
      workspaces: envelope.workspaces,
      tokens,
    });
  }

  #buildWorkspaceProfileSummary(workspace: WorkspaceSummary): WorkspaceProfileSummary {
    const contextKey = workspace.contextKey;
    const runs = runsRepository
      .list()
      .filter((aggregate) => aggregate.run.workspaceId === workspace.workspaceId);
    const recentAssetPaths = new Set<string>();

    let pendingApprovalsCount = 0;
    for (const aggregate of runs) {
      pendingApprovalsCount += aggregate.approvals.filter((item) => item.state === "pending").length;

      for (const file of aggregate.files) {
        if (!isDirectoryPath(file.path)) {
          recentAssetPaths.add(file.path);
        }
      }
    }

    return workspaceProfileSummarySchema.parse({
      workspace,
      metrics: {
        visibleWorkshopsCount: workshopCatalogRepository
          .listWorkshops()
          .filter((item) => item.status === "active" && item.visibleInContexts.includes(contextKey)).length,
        visibleServicesCount: workshopCatalogRepository
          .listServices()
          .filter((item) => item.status === "active" && item.visibleInContexts.includes(contextKey)).length,
        visibleRunsCount: runs.length,
        visiblePackagesCount: creatorRepository
          .listPackages()
          .filter((item) => item.workspaceContextKeys.includes(contextKey)).length,
        pendingApprovalsCount,
        recentAssetsCount: recentAssetPaths.size,
      },
      updatedAt: nowIso(),
    });
  }

  #requireWorkspaceAdmin(userId: string, workspaceId: string) {
    const workspace = authRepository.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", `Workspace not found: ${workspaceId}`);
    }

    const membership = ensureActiveMembership(
      authRepository.getMembership(workspaceId, userId),
      workspaceId,
      userId
    );

    if (!canManageWorkspaceMembers(membership.role)) {
      throw new AppError(
        403,
        "WORKSPACE_ROLE_FORBIDDEN",
        `Workspace role ${membership.role} cannot manage members or invitations`
      );
    }

    return {
      workspace,
      membership,
    };
  }

  #buildInvitationView(record: AuthWorkspaceInvitationRecord): WorkspaceInvitationView {
    const workspace = authRepository.getWorkspaceById(record.workspaceId);
    if (!workspace) {
      throw new AppError(404, "WORKSPACE_NOT_FOUND", `Workspace not found: ${record.workspaceId}`);
    }

    const invitedBy = authRepository.getUserById(record.invitedByUserId);
    return workspaceInvitationViewSchema.parse({
      invitation: toPublicInvitationRecord(record),
      workspace,
      invitedBy: invitedBy ? toPublicUser(invitedBy) : null,
    });
  }
}

export async function initializeAuthInfrastructure() {
  await authRepository.init();
  ensureSequencesBootstrapped();
}

export const authService = new AuthService();
