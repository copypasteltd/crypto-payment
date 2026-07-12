import { authSessionSchema, authUserSchema, workspaceInvitationRecordSchema, workspaceMembershipSchema, workspaceSchema, } from "@lingban/contracts";
import { z } from "zod";
export const authUserRecordSchema = authUserSchema.extend({
    passwordHash: z.string().min(1),
});
export const authSessionRecordSchema = authSessionSchema.extend({
    accessTokenHash: z.string().min(1),
    refreshTokenHash: z.string().min(1),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
});
export const authWorkspaceInvitationRecordSchema = workspaceInvitationRecordSchema.extend({
    acceptTokenHash: z.string().min(1),
});
export const authStateSchema = z.object({
    users: z.array(authUserRecordSchema),
    workspaces: z.array(workspaceSchema),
    memberships: z.array(workspaceMembershipSchema),
    invitations: z.array(authWorkspaceInvitationRecordSchema).default([]),
    sessions: z.array(authSessionRecordSchema),
});
export class CachedAuthRepository {
    #initialized = false;
    #users = new Map();
    #usersByEmail = new Map();
    #workspaces = new Map();
    #memberships = new Map();
    #invitations = new Map();
    #sessions = new Map();
    #sessionsByAccessTokenHash = new Map();
    #sessionsByRefreshTokenHash = new Map();
    #writeChain = Promise.resolve();
    async init() {
        if (this.#initialized) {
            return;
        }
        const state = await this.loadState();
        this.#users.clear();
        this.#usersByEmail.clear();
        this.#workspaces.clear();
        this.#memberships.clear();
        this.#invitations.clear();
        this.#sessions.clear();
        this.#sessionsByAccessTokenHash.clear();
        this.#sessionsByRefreshTokenHash.clear();
        for (const user of state.users) {
            this.#users.set(user.userId, user);
            this.#usersByEmail.set(user.email, user.userId);
        }
        for (const workspace of state.workspaces) {
            this.#workspaces.set(workspace.workspaceId, workspace);
        }
        for (const membership of state.memberships) {
            this.#memberships.set(this.#membershipKey(membership.workspaceId, membership.userId), membership);
        }
        for (const invitation of state.invitations) {
            this.#invitations.set(invitation.invitationId, invitation);
        }
        for (const session of state.sessions) {
            this.#sessions.set(session.sessionId, session);
            this.#sessionsByAccessTokenHash.set(session.accessTokenHash, session.sessionId);
            this.#sessionsByRefreshTokenHash.set(session.refreshTokenHash, session.sessionId);
        }
        this.#initialized = true;
    }
    #membershipKey(workspaceId, userId) {
        return `${workspaceId}:${userId}`;
    }
    snapshotState() {
        return authStateSchema.parse({
            users: [...this.#users.values()],
            workspaces: [...this.#workspaces.values()],
            memberships: [...this.#memberships.values()],
            invitations: [...this.#invitations.values()],
            sessions: [...this.#sessions.values()],
        });
    }
    async persistSnapshot() {
        const next = this.#writeChain
            .catch(() => undefined)
            .then(async () => {
            await this.writeSnapshot(this.snapshotState());
        });
        this.#writeChain = next;
        await next;
    }
    async enqueuePersist(persist) {
        const next = this.#writeChain
            .catch(() => undefined)
            .then(async () => {
            await persist();
        });
        this.#writeChain = next;
        await next;
    }
    async createUser(record) {
        await this.init();
        const parsed = authUserRecordSchema.parse(record);
        this.#users.set(parsed.userId, parsed);
        this.#usersByEmail.set(parsed.email, parsed.userId);
        await this.enqueuePersist(() => this.persistUserRecord(parsed));
        return parsed;
    }
    listUsers() {
        return [...this.#users.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    listWorkspaces() {
        return [...this.#workspaces.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    listSessions() {
        return [...this.#sessions.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    listInvitations() {
        return [...this.#invitations.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.invitationId.localeCompare(right.invitationId));
    }
    findUserByEmail(email) {
        const userId = this.#usersByEmail.get(email);
        return userId ? this.#users.get(userId) ?? null : null;
    }
    getUserById(userId) {
        return this.#users.get(userId) ?? null;
    }
    async createWorkspace(workspace) {
        await this.init();
        this.#workspaces.set(workspace.workspaceId, workspace);
        await this.enqueuePersist(() => this.persistWorkspaceRecord(workspace));
        return workspace;
    }
    getWorkspaceById(workspaceId) {
        return this.#workspaces.get(workspaceId) ?? null;
    }
    listMembershipsByUser(userId) {
        return [...this.#memberships.values()]
            .filter((membership) => membership.userId === userId)
            .map((membership) => ({
            workspace: this.#workspaces.get(membership.workspaceId),
            membership,
        }))
            .sort((left, right) => left.workspace.createdAt.localeCompare(right.workspace.createdAt));
    }
    listMembershipsByWorkspace(workspaceId) {
        return [...this.#memberships.values()]
            .filter((membership) => membership.workspaceId === workspaceId)
            .map((membership) => ({
            user: this.#users.get(membership.userId),
            membership,
        }))
            .filter((item) => Boolean(item.user))
            .sort((left, right) => left.membership.createdAt.localeCompare(right.membership.createdAt) ||
            left.user.userId.localeCompare(right.user.userId));
    }
    getMembership(workspaceId, userId) {
        return this.#memberships.get(this.#membershipKey(workspaceId, userId)) ?? null;
    }
    async addMembership(membership) {
        await this.init();
        this.#memberships.set(this.#membershipKey(membership.workspaceId, membership.userId), membership);
        await this.enqueuePersist(() => this.persistMembershipRecord(membership));
        return membership;
    }
    getInvitationById(invitationId) {
        return this.#invitations.get(invitationId) ?? null;
    }
    listInvitationsByWorkspace(workspaceId) {
        return this.listInvitations().filter((invitation) => invitation.workspaceId === workspaceId);
    }
    listInvitationsByEmail(email) {
        return this.listInvitations().filter((invitation) => invitation.email === email);
    }
    async saveInvitation(record) {
        await this.init();
        const parsed = authWorkspaceInvitationRecordSchema.parse(record);
        this.#invitations.set(parsed.invitationId, parsed);
        await this.enqueuePersist(() => this.persistInvitationRecord(parsed));
        return parsed;
    }
    async createSession(record) {
        await this.init();
        const parsed = authSessionRecordSchema.parse(record);
        this.#sessions.set(parsed.sessionId, parsed);
        this.#sessionsByAccessTokenHash.set(parsed.accessTokenHash, parsed.sessionId);
        this.#sessionsByRefreshTokenHash.set(parsed.refreshTokenHash, parsed.sessionId);
        await this.enqueuePersist(() => this.persistSessionRecord(parsed));
        return parsed;
    }
    async updateSession(record) {
        await this.init();
        const parsed = authSessionRecordSchema.parse(record);
        const previous = this.#sessions.get(parsed.sessionId);
        if (previous) {
            this.#sessionsByAccessTokenHash.delete(previous.accessTokenHash);
            this.#sessionsByRefreshTokenHash.delete(previous.refreshTokenHash);
        }
        this.#sessions.set(parsed.sessionId, parsed);
        this.#sessionsByAccessTokenHash.set(parsed.accessTokenHash, parsed.sessionId);
        this.#sessionsByRefreshTokenHash.set(parsed.refreshTokenHash, parsed.sessionId);
        await this.enqueuePersist(() => this.persistSessionRecord(parsed));
        return parsed;
    }
    findSessionByAccessTokenHash(accessTokenHash) {
        const sessionId = this.#sessionsByAccessTokenHash.get(accessTokenHash);
        return sessionId ? this.#sessions.get(sessionId) ?? null : null;
    }
    findSessionByRefreshTokenHash(refreshTokenHash) {
        const sessionId = this.#sessionsByRefreshTokenHash.get(refreshTokenHash);
        return sessionId ? this.#sessions.get(sessionId) ?? null : null;
    }
    getSessionById(sessionId) {
        return this.#sessions.get(sessionId) ?? null;
    }
}
export class PostgresAuthRepository extends CachedAuthRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadState() {
        const queryable = await this.#getQueryable();
        const [users, workspaces, memberships, invitations, sessions] = await Promise.all([
            queryable.query("SELECT * FROM lingban_users ORDER BY created_at ASC, user_id ASC"),
            queryable.query("SELECT * FROM lingban_workspaces ORDER BY created_at ASC, workspace_id ASC"),
            queryable.query("SELECT * FROM lingban_workspace_memberships ORDER BY created_at ASC, workspace_id ASC, user_id ASC"),
            queryable.query("SELECT * FROM lingban_workspace_invitations ORDER BY created_at DESC, invitation_id ASC"),
            queryable.query("SELECT * FROM lingban_auth_sessions ORDER BY created_at ASC, session_id ASC"),
        ]);
        return authStateSchema.parse({
            users: users.rows.map((row) => ({
                userId: row.user_id,
                email: row.email,
                displayName: row.display_name,
                passwordHash: row.password_hash,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
            })),
            workspaces: workspaces.rows.map((row) => ({
                workspaceId: row.workspace_id,
                slug: row.slug,
                name: row.name,
                type: row.workspace_type,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
            })),
            memberships: memberships.rows.map((row) => ({
                workspaceId: row.workspace_id,
                userId: row.user_id,
                role: row.role,
                status: row.status,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
            })),
            invitations: invitations.rows.map((row) => authWorkspaceInvitationRecordSchema.parse({
                invitationId: row.invitation_id,
                workspaceId: row.workspace_id,
                email: row.email,
                role: row.role,
                status: row.status,
                invitedByUserId: row.invited_by_user_id,
                acceptedByUserId: row.accepted_by_user_id,
                acceptTokenHash: row.accept_token_hash,
                acceptTokenPreview: row.accept_token_preview,
                note: row.note,
                expiresAt: row.expires_at.toISOString(),
                acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
                revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
            })),
            sessions: sessions.rows.map((row) => ({
                sessionId: row.session_id,
                userId: row.user_id,
                currentWorkspaceId: row.current_workspace_id,
                accessTokenHash: row.access_token_hash,
                refreshTokenHash: row.refresh_token_hash,
                accessTokenExpiresAt: row.access_token_expires_at.toISOString(),
                refreshTokenExpiresAt: row.refresh_token_expires_at.toISOString(),
                revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
            })),
        });
    }
    async writeSnapshot(state) {
        const parsed = authStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_auth_sessions");
            await queryable.query("DELETE FROM lingban_workspace_invitations");
            await queryable.query("DELETE FROM lingban_workspace_memberships");
            await queryable.query("DELETE FROM lingban_workspaces");
            await queryable.query("DELETE FROM lingban_users");
            for (const user of parsed.users) {
                await queryable.query(`
          INSERT INTO lingban_users (user_id, email, display_name, password_hash, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          `, [user.userId, user.email, user.displayName, user.passwordHash, user.createdAt, user.updatedAt]);
            }
            for (const workspace of parsed.workspaces) {
                await queryable.query(`
          INSERT INTO lingban_workspaces (workspace_id, slug, name, workspace_type, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          `, [
                    workspace.workspaceId,
                    workspace.slug,
                    workspace.name,
                    workspace.type,
                    workspace.createdAt,
                    workspace.updatedAt,
                ]);
            }
            for (const membership of parsed.memberships) {
                await queryable.query(`
          INSERT INTO lingban_workspace_memberships (
            workspace_id,
            user_id,
            role,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `, [
                    membership.workspaceId,
                    membership.userId,
                    membership.role,
                    membership.status,
                    membership.createdAt,
                    membership.updatedAt,
                ]);
            }
            for (const invitation of parsed.invitations) {
                await queryable.query(`
          INSERT INTO lingban_workspace_invitations (
            invitation_id,
            workspace_id,
            email,
            role,
            status,
            invited_by_user_id,
            accepted_by_user_id,
            accept_token_hash,
            accept_token_preview,
            note,
            expires_at,
            accepted_at,
            revoked_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
                    invitation.invitationId,
                    invitation.workspaceId,
                    invitation.email,
                    invitation.role,
                    invitation.status,
                    invitation.invitedByUserId,
                    invitation.acceptedByUserId,
                    invitation.acceptTokenHash,
                    invitation.acceptTokenPreview,
                    invitation.note,
                    invitation.expiresAt,
                    invitation.acceptedAt,
                    invitation.revokedAt,
                    invitation.createdAt,
                    invitation.updatedAt,
                ]);
            }
            for (const session of parsed.sessions) {
                await queryable.query(`
          INSERT INTO lingban_auth_sessions (
            session_id,
            user_id,
            current_workspace_id,
            access_token_hash,
            refresh_token_hash,
            access_token_expires_at,
            refresh_token_expires_at,
            revoked_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
                    session.sessionId,
                    session.userId,
                    session.currentWorkspaceId,
                    session.accessTokenHash,
                    session.refreshTokenHash,
                    session.accessTokenExpiresAt,
                    session.refreshTokenExpiresAt,
                    session.revokedAt,
                    session.createdAt,
                    session.updatedAt,
                ]);
            }
        });
    }
    async persistUserRecord(record) {
        const parsed = authUserRecordSchema.parse(record);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_users (user_id, email, display_name, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE
      SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `, [
            parsed.userId,
            parsed.email,
            parsed.displayName,
            parsed.passwordHash,
            parsed.createdAt,
            parsed.updatedAt,
        ]);
    }
    async persistWorkspaceRecord(record) {
        const parsed = workspaceSchema.parse(record);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_workspaces (workspace_id, slug, name, workspace_type, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (workspace_id) DO UPDATE
      SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        workspace_type = EXCLUDED.workspace_type,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `, [
            parsed.workspaceId,
            parsed.slug,
            parsed.name,
            parsed.type,
            parsed.createdAt,
            parsed.updatedAt,
        ]);
    }
    async persistMembershipRecord(record) {
        const parsed = workspaceMembershipSchema.parse(record);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_workspace_memberships (
        workspace_id,
        user_id,
        role,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `, [
            parsed.workspaceId,
            parsed.userId,
            parsed.role,
            parsed.status,
            parsed.createdAt,
            parsed.updatedAt,
        ]);
    }
    async persistInvitationRecord(record) {
        const parsed = authWorkspaceInvitationRecordSchema.parse(record);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_workspace_invitations (
        invitation_id,
        workspace_id,
        email,
        role,
        status,
        invited_by_user_id,
        accepted_by_user_id,
        accept_token_hash,
        accept_token_preview,
        note,
        expires_at,
        accepted_at,
        revoked_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (invitation_id) DO UPDATE
      SET
        workspace_id = EXCLUDED.workspace_id,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        invited_by_user_id = EXCLUDED.invited_by_user_id,
        accepted_by_user_id = EXCLUDED.accepted_by_user_id,
        accept_token_hash = EXCLUDED.accept_token_hash,
        accept_token_preview = EXCLUDED.accept_token_preview,
        note = EXCLUDED.note,
        expires_at = EXCLUDED.expires_at,
        accepted_at = EXCLUDED.accepted_at,
        revoked_at = EXCLUDED.revoked_at,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `, [
            parsed.invitationId,
            parsed.workspaceId,
            parsed.email,
            parsed.role,
            parsed.status,
            parsed.invitedByUserId,
            parsed.acceptedByUserId,
            parsed.acceptTokenHash,
            parsed.acceptTokenPreview,
            parsed.note,
            parsed.expiresAt,
            parsed.acceptedAt,
            parsed.revokedAt,
            parsed.createdAt,
            parsed.updatedAt,
        ]);
    }
    async persistSessionRecord(record) {
        const parsed = authSessionRecordSchema.parse(record);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_auth_sessions (
        session_id,
        user_id,
        current_workspace_id,
        access_token_hash,
        refresh_token_hash,
        access_token_expires_at,
        refresh_token_expires_at,
        revoked_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (session_id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        current_workspace_id = EXCLUDED.current_workspace_id,
        access_token_hash = EXCLUDED.access_token_hash,
        refresh_token_hash = EXCLUDED.refresh_token_hash,
        access_token_expires_at = EXCLUDED.access_token_expires_at,
        refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
        revoked_at = EXCLUDED.revoked_at,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      `, [
            parsed.sessionId,
            parsed.userId,
            parsed.currentWorkspaceId,
            parsed.accessTokenHash,
            parsed.refreshTokenHash,
            parsed.accessTokenExpiresAt,
            parsed.refreshTokenExpiresAt,
            parsed.revokedAt,
            parsed.createdAt,
            parsed.updatedAt,
        ]);
    }
}
//# sourceMappingURL=auth-repository.js.map