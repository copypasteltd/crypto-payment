import { type Workspace, type WorkspaceMembership } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const authUserRecordSchema: z.ZodObject<{
    userId: z.ZodString;
    email: z.ZodString;
    displayName: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    passwordHash: z.ZodString;
}, z.core.$strip>;
export declare const authSessionRecordSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    currentWorkspaceId: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshTokenExpiresAt: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    accessTokenHash: z.ZodString;
    refreshTokenHash: z.ZodString;
    revokedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const authWorkspaceInvitationRecordSchema: z.ZodObject<{
    invitationId: z.ZodString;
    workspaceId: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        operator: "operator";
        creator: "creator";
        viewer: "viewer";
    }>;
    status: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        revoked: "revoked";
        expired: "expired";
    }>;
    invitedByUserId: z.ZodString;
    acceptedByUserId: z.ZodNullable<z.ZodString>;
    acceptTokenPreview: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodString;
    acceptedAt: z.ZodNullable<z.ZodString>;
    revokedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    acceptTokenHash: z.ZodString;
}, z.core.$strip>;
export declare const authStateSchema: z.ZodObject<{
    users: z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        passwordHash: z.ZodString;
    }, z.core.$strip>>;
    workspaces: z.ZodArray<z.ZodObject<{
        workspaceId: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            enterprise: "enterprise";
            personal: "personal";
            team: "team";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    memberships: z.ZodArray<z.ZodObject<{
        workspaceId: z.ZodString;
        userId: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        status: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    invitations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        invitationId: z.ZodString;
        workspaceId: z.ZodString;
        email: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        status: z.ZodEnum<{
            pending: "pending";
            accepted: "accepted";
            revoked: "revoked";
            expired: "expired";
        }>;
        invitedByUserId: z.ZodString;
        acceptedByUserId: z.ZodNullable<z.ZodString>;
        acceptTokenPreview: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodString;
        acceptedAt: z.ZodNullable<z.ZodString>;
        revokedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        acceptTokenHash: z.ZodString;
    }, z.core.$strip>>>;
    sessions: z.ZodArray<z.ZodObject<{
        sessionId: z.ZodString;
        userId: z.ZodString;
        currentWorkspaceId: z.ZodString;
        accessTokenExpiresAt: z.ZodString;
        refreshTokenExpiresAt: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        accessTokenHash: z.ZodString;
        refreshTokenHash: z.ZodString;
        revokedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AuthUserRecord = z.infer<typeof authUserRecordSchema>;
export type AuthSessionRecord = z.infer<typeof authSessionRecordSchema>;
export type AuthWorkspaceInvitationRecord = z.infer<typeof authWorkspaceInvitationRecordSchema>;
export type AuthStorageState = z.infer<typeof authStateSchema>;
export interface AuthRepository {
    init(): Promise<void>;
    listUsers(): AuthUserRecord[];
    listWorkspaces(): Workspace[];
    listSessions(): AuthSessionRecord[];
    listInvitations(): AuthWorkspaceInvitationRecord[];
    createUser(record: AuthUserRecord): Promise<AuthUserRecord>;
    findUserByEmail(email: string): AuthUserRecord | null;
    getUserById(userId: string): AuthUserRecord | null;
    createWorkspace(workspace: Workspace): Promise<Workspace>;
    getWorkspaceById(workspaceId: string): Workspace | null;
    listMembershipsByUser(userId: string): Array<{
        workspace: Workspace;
        membership: WorkspaceMembership;
    }>;
    listMembershipsByWorkspace(workspaceId: string): Array<{
        user: AuthUserRecord;
        membership: WorkspaceMembership;
    }>;
    getMembership(workspaceId: string, userId: string): WorkspaceMembership | null;
    addMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership>;
    getInvitationById(invitationId: string): AuthWorkspaceInvitationRecord | null;
    listInvitationsByWorkspace(workspaceId: string): AuthWorkspaceInvitationRecord[];
    listInvitationsByEmail(email: string): AuthWorkspaceInvitationRecord[];
    saveInvitation(record: AuthWorkspaceInvitationRecord): Promise<AuthWorkspaceInvitationRecord>;
    createSession(record: AuthSessionRecord): Promise<AuthSessionRecord>;
    updateSession(record: AuthSessionRecord): Promise<AuthSessionRecord>;
    findSessionByAccessTokenHash(accessTokenHash: string): AuthSessionRecord | null;
    findSessionByRefreshTokenHash(refreshTokenHash: string): AuthSessionRecord | null;
    getSessionById(sessionId: string): AuthSessionRecord | null;
}
export declare abstract class CachedAuthRepository implements AuthRepository {
    #private;
    init(): Promise<void>;
    protected snapshotState(): AuthStorageState;
    protected persistSnapshot(): Promise<void>;
    protected enqueuePersist(persist: () => Promise<void>): Promise<void>;
    createUser(record: AuthUserRecord): Promise<{
        userId: string;
        email: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
        passwordHash: string;
    }>;
    listUsers(): {
        userId: string;
        email: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
        passwordHash: string;
    }[];
    listWorkspaces(): {
        workspaceId: string;
        slug: string;
        name: string;
        type: "enterprise" | "personal" | "team";
        createdAt: string;
        updatedAt: string;
    }[];
    listSessions(): {
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    }[];
    listInvitations(): {
        invitationId: string;
        workspaceId: string;
        email: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        invitedByUserId: string;
        acceptedByUserId: string | null;
        acceptTokenPreview: string | null;
        note: string | null;
        expiresAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
        updatedAt: string;
        acceptTokenHash: string;
    }[];
    findUserByEmail(email: string): {
        userId: string;
        email: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
        passwordHash: string;
    } | null;
    getUserById(userId: string): {
        userId: string;
        email: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
        passwordHash: string;
    } | null;
    createWorkspace(workspace: Workspace): Promise<{
        workspaceId: string;
        slug: string;
        name: string;
        type: "enterprise" | "personal" | "team";
        createdAt: string;
        updatedAt: string;
    }>;
    getWorkspaceById(workspaceId: string): {
        workspaceId: string;
        slug: string;
        name: string;
        type: "enterprise" | "personal" | "team";
        createdAt: string;
        updatedAt: string;
    } | null;
    listMembershipsByUser(userId: string): {
        workspace: {
            workspaceId: string;
            slug: string;
            name: string;
            type: "enterprise" | "personal" | "team";
            createdAt: string;
            updatedAt: string;
        };
        membership: {
            workspaceId: string;
            userId: string;
            role: "owner" | "admin" | "operator" | "creator" | "viewer";
            status: "active" | "suspended";
            createdAt: string;
            updatedAt: string;
        };
    }[];
    listMembershipsByWorkspace(workspaceId: string): {
        user: {
            userId: string;
            email: string;
            displayName: string;
            createdAt: string;
            updatedAt: string;
            passwordHash: string;
        };
        membership: {
            workspaceId: string;
            userId: string;
            role: "owner" | "admin" | "operator" | "creator" | "viewer";
            status: "active" | "suspended";
            createdAt: string;
            updatedAt: string;
        };
    }[];
    getMembership(workspaceId: string, userId: string): {
        workspaceId: string;
        userId: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "active" | "suspended";
        createdAt: string;
        updatedAt: string;
    } | null;
    addMembership(membership: WorkspaceMembership): Promise<{
        workspaceId: string;
        userId: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "active" | "suspended";
        createdAt: string;
        updatedAt: string;
    }>;
    getInvitationById(invitationId: string): {
        invitationId: string;
        workspaceId: string;
        email: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        invitedByUserId: string;
        acceptedByUserId: string | null;
        acceptTokenPreview: string | null;
        note: string | null;
        expiresAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
        updatedAt: string;
        acceptTokenHash: string;
    } | null;
    listInvitationsByWorkspace(workspaceId: string): {
        invitationId: string;
        workspaceId: string;
        email: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        invitedByUserId: string;
        acceptedByUserId: string | null;
        acceptTokenPreview: string | null;
        note: string | null;
        expiresAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
        updatedAt: string;
        acceptTokenHash: string;
    }[];
    listInvitationsByEmail(email: string): {
        invitationId: string;
        workspaceId: string;
        email: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        invitedByUserId: string;
        acceptedByUserId: string | null;
        acceptTokenPreview: string | null;
        note: string | null;
        expiresAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
        updatedAt: string;
        acceptTokenHash: string;
    }[];
    saveInvitation(record: AuthWorkspaceInvitationRecord): Promise<{
        invitationId: string;
        workspaceId: string;
        email: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        invitedByUserId: string;
        acceptedByUserId: string | null;
        acceptTokenPreview: string | null;
        note: string | null;
        expiresAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
        updatedAt: string;
        acceptTokenHash: string;
    }>;
    createSession(record: AuthSessionRecord): Promise<{
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    }>;
    updateSession(record: AuthSessionRecord): Promise<{
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    }>;
    findSessionByAccessTokenHash(accessTokenHash: string): {
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    } | null;
    findSessionByRefreshTokenHash(refreshTokenHash: string): {
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    } | null;
    getSessionById(sessionId: string): {
        sessionId: string;
        userId: string;
        currentWorkspaceId: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
        createdAt: string;
        updatedAt: string;
        accessTokenHash: string;
        refreshTokenHash: string;
        revokedAt: string | null;
    } | null;
    protected abstract loadState(): Promise<AuthStorageState>;
    protected abstract writeSnapshot(state: AuthStorageState): Promise<void>;
    protected abstract persistUserRecord(record: AuthUserRecord): Promise<void>;
    protected abstract persistWorkspaceRecord(record: Workspace): Promise<void>;
    protected abstract persistMembershipRecord(record: WorkspaceMembership): Promise<void>;
    protected abstract persistInvitationRecord(record: AuthWorkspaceInvitationRecord): Promise<void>;
    protected abstract persistSessionRecord(record: AuthSessionRecord): Promise<void>;
}
export interface PostgresAuthRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresAuthRepository extends CachedAuthRepository {
    #private;
    constructor(options: PostgresAuthRepositoryOptions);
    protected loadState(): Promise<{
        users: {
            userId: string;
            email: string;
            displayName: string;
            createdAt: string;
            updatedAt: string;
            passwordHash: string;
        }[];
        workspaces: {
            workspaceId: string;
            slug: string;
            name: string;
            type: "enterprise" | "personal" | "team";
            createdAt: string;
            updatedAt: string;
        }[];
        memberships: {
            workspaceId: string;
            userId: string;
            role: "owner" | "admin" | "operator" | "creator" | "viewer";
            status: "active" | "suspended";
            createdAt: string;
            updatedAt: string;
        }[];
        invitations: {
            invitationId: string;
            workspaceId: string;
            email: string;
            role: "owner" | "admin" | "operator" | "creator" | "viewer";
            status: "pending" | "accepted" | "revoked" | "expired";
            invitedByUserId: string;
            acceptedByUserId: string | null;
            acceptTokenPreview: string | null;
            note: string | null;
            expiresAt: string;
            acceptedAt: string | null;
            revokedAt: string | null;
            createdAt: string;
            updatedAt: string;
            acceptTokenHash: string;
        }[];
        sessions: {
            sessionId: string;
            userId: string;
            currentWorkspaceId: string;
            accessTokenExpiresAt: string;
            refreshTokenExpiresAt: string;
            createdAt: string;
            updatedAt: string;
            accessTokenHash: string;
            refreshTokenHash: string;
            revokedAt: string | null;
        }[];
    }>;
    protected writeSnapshot(state: AuthStorageState): Promise<void>;
    protected persistUserRecord(record: AuthUserRecord): Promise<void>;
    protected persistWorkspaceRecord(record: Workspace): Promise<void>;
    protected persistMembershipRecord(record: WorkspaceMembership): Promise<void>;
    protected persistInvitationRecord(record: AuthWorkspaceInvitationRecord): Promise<void>;
    protected persistSessionRecord(record: AuthSessionRecord): Promise<void>;
}
//# sourceMappingURL=auth-repository.d.ts.map