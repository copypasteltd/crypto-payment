import { z } from "zod";
import { bridgeEventSchema } from "./bridge.js";
import { runIdSchema } from "./common.js";
import { approveRunInputSchema, runSnapshotSchema, sendRunMessageInputSchema } from "./runs.js";
export const clientRealtimeMessageSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("runs.subscribe"),
        runId: runIdSchema,
    }),
    z.object({
        type: z.literal("runs.sendMessage"),
        runId: runIdSchema,
        payload: sendRunMessageInputSchema,
    }),
    z.object({
        type: z.literal("runs.approve"),
        runId: runIdSchema,
        payload: approveRunInputSchema,
    }),
    z.object({
        type: z.literal("runs.cancel"),
        runId: runIdSchema,
        reason: z.string().min(1).optional(),
    }),
]);
export const serverRealtimeMessageSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("runs.snapshot"),
        payload: runSnapshotSchema,
    }),
    z.object({
        type: z.literal("runs.event"),
        payload: bridgeEventSchema,
    }),
    z.object({
        type: z.literal("runs.ack"),
        runId: runIdSchema,
        ok: z.boolean(),
    }),
    z.object({
        type: z.literal("runs.error"),
        runId: runIdSchema.optional(),
        error: z.string().min(1),
    }),
]);
//# sourceMappingURL=realtime.js.map