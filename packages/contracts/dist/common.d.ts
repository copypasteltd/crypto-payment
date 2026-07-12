import { z } from "zod";
export declare const isoDatetimeSchema: z.ZodString;
export declare const userIdSchema: z.ZodString;
export declare const workspaceIdSchema: z.ZodString;
export declare const taskIdSchema: z.ZodString;
export declare const taskVersionIdSchema: z.ZodString;
export declare const sessionIdSchema: z.ZodString;
export declare const sessionVersionIdSchema: z.ZodString;
export declare const runIdSchema: z.ZodString;
export declare const artifactIdSchema: z.ZodString;
export declare const approvalIdSchema: z.ZodString;
export declare const workspaceInvitationIdSchema: z.ZodString;
export declare const uploadIdSchema: z.ZodString;
export declare const downloadTicketIdSchema: z.ZodString;
export declare const credentialIdSchema: z.ZodString;
export declare const mcpBindingIdSchema: z.ZodString;
export declare const mcpHealthSnapshotIdSchema: z.ZodString;
export declare const bridgeIdSchema: z.ZodString;
export declare const entrySurfaceSchema: z.ZodEnum<{
    dashboard: "dashboard";
    h5: "h5";
    "mini-program": "mini-program";
}>;
export declare const messageRoleSchema: z.ZodEnum<{
    system: "system";
    user: "user";
    agent: "agent";
}>;
export declare const messageKindSchema: z.ZodEnum<{
    prompt: "prompt";
    status: "status";
    approval: "approval";
    result: "result";
    text: "text";
}>;
export declare const fileKindSchema: z.ZodEnum<{
    output: "output";
    input: "input";
    receipt: "receipt";
    archive: "archive";
    log: "log";
    screenshot: "screenshot";
}>;
export declare const artifactStatusSchema: z.ZodEnum<{
    pending: "pending";
    ready: "ready";
}>;
export declare const approvalStateSchema: z.ZodEnum<{
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
}>;
export declare const connectorSourceSchema: z.ZodEnum<{
    "first-party": "first-party";
    "workspace-managed": "workspace-managed";
    "third-party": "third-party";
}>;
export declare const connectorTransportSchema: z.ZodEnum<{
    stdio: "stdio";
    http: "http";
    sse: "sse";
    websocket: "websocket";
}>;
export declare const credentialMountModeSchema: z.ZodEnum<{
    env: "env";
    file: "file";
}>;
export type EntrySurface = z.infer<typeof entrySurfaceSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageKind = z.infer<typeof messageKindSchema>;
export type FileKind = z.infer<typeof fileKindSchema>;
//# sourceMappingURL=common.d.ts.map