import { z } from "zod";
import { bridgeEventSchema, createRunInputSchema, runIdSchema, runSnapshotSchema, startRunJobPayloadSchema, } from "@lingban/contracts";
export const runAggregateSchema = runSnapshotSchema.extend({
    input: createRunInputSchema,
    startJob: startRunJobPayloadSchema,
});
export function projectRunSnapshot(aggregate) {
    return runSnapshotSchema.parse(aggregate);
}
export const runEventEnvelopeSchema = z.object({
    eventId: z.string().min(1),
    runId: runIdSchema,
    event: bridgeEventSchema,
});
//# sourceMappingURL=runs.js.map