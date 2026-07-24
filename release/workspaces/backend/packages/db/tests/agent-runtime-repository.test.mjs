import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAgentRuntimeRepository } from "../dist/index.js";

test("agent runtime repository exposes the highest persisted event sequence", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const event = (sequence) => ({
    eventId: `aev_${sequence}`,
    runId: "run_event_watermark",
    sequence,
    eventType: "turn/completed",
    occurredAt: "2026-07-24T10:00:00.000Z",
    receivedAt: "2026-07-24T10:00:00.000Z",
    threadId: "thread_event_watermark",
    turnId: "turn_event_watermark",
    itemId: null,
    sourceRequestId: null,
    payloadSha256: String(sequence).padStart(64, "0"),
    payload: { sequence },
  });

  assert.equal(await repository.getEventHighWatermark("run_event_watermark"), 0);
  await repository.appendEvent(event(7));
  await repository.appendEvent(event(11));
  await repository.appendEvent(event(9));
  assert.equal(await repository.getEventHighWatermark("run_event_watermark"), 11);
});
