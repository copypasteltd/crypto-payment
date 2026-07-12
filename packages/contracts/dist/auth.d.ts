import { z } from "zod";
export declare const workspaceTypeSchema: z.ZodEnum<{
    enterprise: "enterprise";
    personal: "personal";
    team: "team";
}>;
export declare const workspaceRoleSchema: z.ZodEnum<{
    owner: "owner";
    admin: "admin";
    operator: "operator";
    creator: "creator";
    viewer: "viewer";
}>;
export declare const workspaceMembershipStatusSchema: z.ZodEnum<{
    active: "active";
    suspended: "suspended";
}>;
export declare const workspaceInvitationStatusSchema: z.ZodEnum<{
    pending: "pending";
    accepted: "accepted";
    revoked: "revoked";
    expired: "expired";
}>;
export declare const authUserSchema: z.ZodObject<{
    userId: z.ZodString;
    email: z.ZodString;
    displayName: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const workspaceSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const workspaceMembershipSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const workspaceSummarySchema: z.ZodObject<{
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
    contextKey: z.ZodString;
    root: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        operator: "operator";
        creator: "creator";
        viewer: "viewer";
    }>;
    membershipStatus: z.ZodEnum<{
        active: "active";
        suspended: "suspended";
    }>;
}, z.core.$strip>;
export declare const workspaceProfileMetricsSchema: z.ZodObject<{
    visibleWorkshopsCount: z.ZodNumber;
    visibleServicesCount: z.ZodNumber;
    visibleRunsCount: z.ZodNumber;
    visiblePackagesCount: z.ZodNumber;
    pendingApprovalsCount: z.ZodNumber;
    recentAssetsCount: z.ZodNumber;
}, z.core.$strip>;
export declare const workspaceProfileSummarySchema: z.ZodObject<{
    workspace: z.ZodObject<{
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
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>;
    metrics: z.ZodObject<{
        visibleWorkshopsCount: z.ZodNumber;
        visibleServicesCount: z.ZodNumber;
        visibleRunsCount: z.ZodNumber;
        visiblePackagesCount: z.ZodNumber;
        pendingApprovalsCount: z.ZodNumber;
        recentAssetsCount: z.ZodNumber;
    }, z.core.$strip>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const workspaceMemberRecordSchema: z.ZodObject<{
    user: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    membership: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const workspaceInvitationRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const workspaceInvitationViewSchema: z.ZodObject<{
    invitation: z.ZodObject<{
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
    }, z.core.$strip>;
    workspace: z.ZodObject<{
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
    }, z.core.$strip>;
    invitedBy: z.ZodNullable<z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const authSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    currentWorkspaceId: z.ZodString;
    accessTokenExpiresAt: z.ZodString;
    refreshTokenExpiresAt: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const authTokenPairSchema: z.ZodObject<{
    tokenType: z.ZodLiteral<"Bearer">;
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    expiresInSeconds: z.ZodNumber;
}, z.core.$strip>;
export declare const authSessionEnvelopeSchema: z.ZodObject<{
    user: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    session: z.ZodObject<{
        sessionId: z.ZodString;
        userId: z.ZodString;
        currentWorkspaceId: z.ZodString;
        accessTokenExpiresAt: z.ZodString;
        refreshTokenExpiresAt: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    currentWorkspace: z.ZodObject<{
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
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>;
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
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const authSessionResponseSchema: z.ZodObject<{
    user: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    session: z.ZodObject<{
        sessionId: z.ZodString;
        userId: z.ZodString;
        currentWorkspaceId: z.ZodString;
        accessTokenExpiresAt: z.ZodString;
        refreshTokenExpiresAt: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    currentWorkspace: z.ZodObject<{
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
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>;
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
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>>;
    tokens: z.ZodObject<{
        tokenType: z.ZodLiteral<"Bearer">;
        accessToken: z.ZodString;
        refreshToken: z.ZodString;
        expiresInSeconds: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const registerAuthInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
    workspaceName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginAuthInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const refreshAuthInputSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
export declare const logoutAuthInputSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const switchWorkspaceInputSchema: z.ZodObject<{
    workspaceId: z.ZodString;
}, z.core.$strip>;
export declare const createWorkspaceInvitationInputSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        operator: "operator";
        creator: "creator";
        viewer: "viewer";
    }>;
    note: z.ZodOptional<z.ZodString>;
    expiresInDays: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const createWorkspaceInvitationResponseSchema: z.ZodObject<{
    invitation: z.ZodObject<{
        invitation: z.ZodObject<{
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
        }, z.core.$strip>;
        workspace: z.ZodObject<{
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
        }, z.core.$strip>;
        invitedBy: z.ZodNullable<z.ZodObject<{
            userId: z.ZodString;
            email: z.ZodString;
            displayName: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    acceptToken: z.ZodString;
}, z.core.$strip>;
export declare const updateWorkspaceMembershipInputSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        operator: "operator";
        creator: "creator";
        viewer: "viewer";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        suspended: "suspended";
    }>>;
}, z.core.$strip>;
export declare const acceptWorkspaceInvitationInputSchema: z.ZodObject<{
    acceptToken: z.ZodString;
}, z.core.$strip>;
export declare const acceptWorkspaceInvitationResponseSchema: z.ZodObject<{
    invitation: z.ZodObject<{
        invitation: z.ZodObject<{
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
        }, z.core.$strip>;
        workspace: z.ZodObject<{
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
        }, z.core.$strip>;
        invitedBy: z.ZodNullable<z.ZodObject<{
            userId: z.ZodString;
            email: z.ZodString;
            displayName: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    session: z.ZodObject<{
        user: z.ZodObject<{
            userId: z.ZodString;
            email: z.ZodString;
            displayName: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        session: z.ZodObject<{
            sessionId: z.ZodString;
            userId: z.ZodString;
            currentWorkspaceId: z.ZodString;
            accessTokenExpiresAt: z.ZodString;
            refreshTokenExpiresAt: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        currentWorkspace: z.ZodObject<{
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
            contextKey: z.ZodString;
            root: z.ZodString;
            role: z.ZodEnum<{
                owner: "owner";
                admin: "admin";
                operator: "operator";
                creator: "creator";
                viewer: "viewer";
            }>;
            membershipStatus: z.ZodEnum<{
                active: "active";
                suspended: "suspended";
            }>;
        }, z.core.$strip>;
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
            contextKey: z.ZodString;
            root: z.ZodString;
            role: z.ZodEnum<{
                owner: "owner";
                admin: "admin";
                operator: "operator";
                creator: "creator";
                viewer: "viewer";
            }>;
            membershipStatus: z.ZodEnum<{
                active: "active";
                suspended: "suspended";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
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
export type AuthTokenPair = z.infer<typeof authTokenPairSchema>;
export type AuthSessionEnvelope = z.infer<typeof authSessionEnvelopeSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type RegisterAuthInput = z.infer<typeof registerAuthInputSchema>;
export type LoginAuthInput = z.infer<typeof loginAuthInputSchema>;
export type RefreshAuthInput = z.infer<typeof refreshAuthInputSchema>;
export type LogoutAuthInput = z.infer<typeof logoutAuthInputSchema>;
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceInputSchema>;
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationInputSchema>;
export type CreateWorkspaceInvitationResponse = z.infer<typeof createWorkspaceInvitationResponseSchema>;
export type UpdateWorkspaceMembershipInput = z.infer<typeof updateWorkspaceMembershipInputSchema>;
export type AcceptWorkspaceInvitationInput = z.infer<typeof acceptWorkspaceInvitationInputSchema>;
export type AcceptWorkspaceInvitationResponse = z.infer<typeof acceptWorkspaceInvitationResponseSchema>;
//# sourceMappingURL=auth.d.ts.map