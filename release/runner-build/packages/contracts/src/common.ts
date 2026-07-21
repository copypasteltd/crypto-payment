import { z } from "./zod.js";

export const isoDatetimeSchema = z.string().datetime({ offset: true });

export const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  return value;
}, z.boolean());

const prefixedId = (prefix: string) =>
  z.string().min(prefix.length + 1).refine((value) => value.startsWith(prefix), {
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
export const providerIdSchema = prefixedId("prv_");
export const workspaceProviderBindingIdSchema = prefixedId("wpb_");
export const sessionCaptureIdSchema = prefixedId("cap_");
export const sessionProjectIdSchema = prefixedId("spj_");
export const sessionCaptureAccessAuditIdSchema = prefixedId("scaa_");
export const sessionDraftIdSchema = prefixedId("sdf_");
export const sessionDraftRevisionIdSchema = prefixedId("sdr_");
export const sessionReviewIdSchema = prefixedId("srw_");
export const sessionReplayIdSchema = prefixedId("replay_");
export const creatorPackageSessionBindingIdSchema = prefixedId("cpsb_");
export const serviceSessionBindingIdSchema = prefixedId("ssb_");
export const agentEventIdSchema = prefixedId("aev_");

export const entrySurfaceSchema = z.enum(["dashboard", "h5", "mini-program"]);
export const messageRoleSchema = z.enum(["system", "user", "agent"]);
export const messageKindSchema = z.enum(["prompt", "status", "approval", "result", "text"]);
export const fileKindSchema = z.enum(["input", "output", "receipt", "archive", "log", "screenshot"]);
export const artifactStatusSchema = z.enum(["pending", "ready"]);
export const approvalStateSchema = z.enum(["pending", "approved", "rejected"]);
export const connectorSourceSchema = z.enum(["first-party", "workspace-managed", "third-party"]);
export const connectorTransportSchema = z.enum(["stdio", "http", "sse", "websocket"]);
export const credentialMountModeSchema = z.enum(["env", "file"]);

export type EntrySurface = z.infer<typeof entrySurfaceSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageKind = z.infer<typeof messageKindSchema>;
export type FileKind = z.infer<typeof fileKindSchema>;
