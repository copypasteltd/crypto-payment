import type { FastifyInstance } from "fastify";
import {
  clientRealtimeMessageSchema,
  serverRealtimeMessageSchema,
  type ServerRealtimeMessage,
} from "@lingban/contracts";
import { normalizeErrorPayload } from "../../app/errors.js";
import { requireWorkspaceAccess } from "../auth/request-auth.js";
import { runIdParamsSchema } from "../runs/routes.js";
import { runsService } from "../runs/service.js";
import { runEventBus } from "./event-bus.js";

function toMessageText(raw: unknown) {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }

  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString("utf8");
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(
      raw.map((entry) => {
        if (typeof entry === "string") {
          return Buffer.from(entry, "utf8");
        }

        if (entry instanceof ArrayBuffer) {
          return Buffer.from(entry);
        }

        if (ArrayBuffer.isView(entry)) {
          return Buffer.from(entry.buffer, entry.byteOffset, entry.byteLength);
        }

        return Buffer.from(String(entry), "utf8");
      })
    ).toString("utf8");
  }

  return String(raw ?? "");
}

function sendRealtimeMessage(
  socket: { send(data: string): void },
  message: ServerRealtimeMessage
) {
  socket.send(JSON.stringify(serverRealtimeMessageSchema.parse(message)));
}

function sendRealtimeError(
  socket: { send(data: string): void },
  error: unknown,
  runId?: string
) {
  const normalized = normalizeErrorPayload(error);
  sendRealtimeMessage(socket, {
    type: "runs.error",
    runId,
    error: normalized.payload.error.message,
  });
}

function sendRunSnapshot(socket: { send(data: string): void }, runId: string) {
  sendRealtimeMessage(socket, {
    type: "runs.snapshot",
    payload: runsService.getRun(runId),
  });
}

function sendBacklog(socket: { send(data: string): void }, runId: string) {
  for (const envelope of runEventBus.list(runId)) {
    sendRealtimeMessage(socket, {
      type: "runs.event",
      payload: envelope.event,
    });
  }
}

function sendAck(socket: { send(data: string): void }, runId: string, ok = true) {
  sendRealtimeMessage(socket, {
    type: "runs.ack",
    runId,
    ok,
  });
}

export async function registerRealtimeSocketRoutes(server: FastifyInstance) {
  server.get("/:runId", { websocket: true }, (socket, request) => {
    const parsedParams = runIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      sendRealtimeError(socket, parsedParams.error);
      socket.close(1008, "invalid_run_id");
      return;
    }

    const { runId } = parsedParams.data;

    try {
      const snapshot = runsService.getRun(runId);
      requireWorkspaceAccess(request, snapshot.run.workspaceId);
    } catch (error) {
      sendRealtimeError(socket, error, runId);
      socket.close(1008, "run_not_found");
      return;
    }

    sendRunSnapshot(socket, runId);
    sendBacklog(socket, runId);
    sendAck(socket, runId);

    const unsubscribe = runEventBus.subscribe(runId, (envelope) => {
      sendRealtimeMessage(socket, {
        type: "runs.event",
        payload: envelope.event,
      });
    });

    const cleanup = () => {
      unsubscribe();
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);

    socket.on("message", async (raw: unknown) => {
      try {
        const parsed = clientRealtimeMessageSchema.parse(
          JSON.parse(toMessageText(raw)) as unknown
        );

        if (parsed.runId !== runId) {
          throw new Error("WebSocket 路径与消息中的 runId 不一致");
        }

        switch (parsed.type) {
          case "runs.subscribe":
            sendRunSnapshot(socket, runId);
            sendAck(socket, runId);
            break;
          case "runs.sendMessage":
            await runsService.sendMessage(runId, parsed.payload);
            sendAck(socket, runId);
            break;
          case "runs.approve":
            {
              const snapshot = runsService.getRun(runId);
              const authContext = requireWorkspaceAccess(
                request,
                snapshot.run.workspaceId,
                ["owner", "admin", "operator"]
              );
              await runsService.approve(runId, parsed.payload, {
                decidedByUserId: authContext?.user.userId ?? null,
                decisionMode: "manual",
                awaitBridgeDispatch: true,
              });
            }
            sendAck(socket, runId);
            break;
          case "runs.cancel":
            await runsService.cancel(runId, parsed.reason);
            sendAck(socket, runId);
            break;
        }
      } catch (error) {
        sendRealtimeError(socket, error, runId);
      }
    });
  });
}
