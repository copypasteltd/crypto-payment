import { z } from "zod";
export const isoDatetimeSchema = z.string().datetime({ offset: true });
const prefixedId = (prefix) => z.string().min(prefix.length + 1).refine((value) => value.startsWith(prefix), {
    message: `Expected id to start with ${prefix}`,
});
export const userIdSchema = prefixedId("usr_");
export const workspaceIdSchema = prefixedId("wsp_");
export const taskIdSchema = prefixedId("tsk_");
export const taskVersionIdSchema = prefixedId("tsv_");
export const sessionIdSchema = prefixedId("ses_");
export const sessionVersionIdSchema = prefixedId("sev_");
export const runIdSchema = prefixedId("run_");
export const artifactIdSchema = prefixedId("art_");
export const approvalIdSchema = prefixedId("apr_");
export const workspaceInvitationIdSchema = prefixedId("wiv_");
export const uploadIdSchema = prefixedId("upl_");
export const downloadTicketIdSchema = prefixedId("dlt_");
export const credentialIdSchema = prefixedId("cred_");
export const mcpBindingIdSchema = prefixedId("mbd_");
export const mcpHealthSnapshotIdSchema = prefixedId("chs_");
export const bridgeIdSchema = prefixedId("brg_");
export const entrySurfaceSchema = z.enum(["dashboard", "h5", "mini-program"]);
export const messageRoleSchema = z.enum(["system", "user", "agent"]);
export const messageKindSchema = z.enum(["prompt", "status", "approval", "result", "text"]);
export const fileKindSchema = z.enum(["input", "output", "receipt", "archive", "log", "screenshot"]);
export const artifactStatusSchema = z.enum(["pending", "ready"]);
export const approvalStateSchema = z.enum(["pending", "approved", "rejected"]);
export const connectorSourceSchema = z.enum(["first-party", "workspace-managed", "third-party"]);
export const connectorTransportSchema = z.enum(["stdio", "http", "sse", "websocket"]);
export const credentialMountModeSchema = z.enum(["env", "file"]);
//# sourceMappingURL=common.js.map