import { createRunsRealtimeClient, type RunRealtimeConnection } from "@lingban/api-sdk";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  type ApproveRunInput,
  type RunSnapshot,
  type SendRunMessageInput,
} from "@lingban/contracts";
import { applyBridgeEventToRunSnapshot } from "@lingban/domain-models";

type Transport = "idle" | "ws" | "sse";

export type RunStreamState = {
  connected: boolean;
  transport: Transport;
  sendMessage(input: SendRunMessageInput): boolean;
  approve(input: ApproveRunInput): boolean;
  sendMessageAwaitAck(input: SendRunMessageInput): Promise<void>;
  approveAwaitAck(input: ApproveRunInput): Promise<void>;
};

type QueryKeyFactory = QueryKey | ((runId: string) => QueryKey);

export type CreateRunStreamHookOptions = {
  baseUrl: string;
  getAccessToken: () => string | null | undefined;
  detailQueryKey: (runId: string) => QueryKey;
  filesQueryKey: (runId: string) => QueryKey;
  listQueryKey?: QueryKeyFactory;
};

function resolveQueryKey(factory: QueryKeyFactory | undefined, runId: string): QueryKey | null {
  if (!factory) {
    return null;
  }

  return typeof factory === "function" ? factory(runId) : factory;
}

export function upsertRunSnapshot(list: RunSnapshot[] | undefined, snapshot: RunSnapshot) {
  const current = list ?? [];
  const index = current.findIndex((item) => item.run.runId === snapshot.run.runId);

  if (index === -1) {
    return [snapshot, ...current];
  }

  return current.map((item, itemIndex) => (itemIndex === index ? snapshot : item));
}

export function createUseRunStream(options: CreateRunStreamHookOptions) {
  const runsRealtime = createRunsRealtimeClient({
    baseUrl: options.baseUrl,
    getAccessToken: () => options.getAccessToken() ?? undefined,
  });

  return function useRunStream(runId: string | null, enabled = true): RunStreamState {
    const queryClient = useQueryClient();
    const connectionRef = useRef<RunRealtimeConnection | null>(null);
    const pendingCommandsRef = useRef<
      Array<{
        resolve: () => void;
        reject: (error: Error) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }>
    >([]);
    const [connected, setConnected] = useState(false);
    const [transport, setTransport] = useState<Transport>("idle");

    useEffect(() => {
      const rejectPendingCommands = (message: string) => {
        while (pendingCommandsRef.current.length > 0) {
          const pending = pendingCommandsRef.current.shift();
          if (!pending) {
            continue;
          }

          clearTimeout(pending.timeoutId);
          pending.reject(new Error(message));
        }
      };

      connectionRef.current?.close();
      connectionRef.current = null;
      rejectPendingCommands("Realtime connection reset.");
      setConnected(false);
      setTransport("idle");

      if (!enabled || !runId) {
        return;
      }

      const detailQueryKey = options.detailQueryKey(runId);
      const filesQueryKey = options.filesQueryKey(runId);
      const listQueryKey = resolveQueryKey(options.listQueryKey, runId);

      const syncSnapshot = (snapshot: RunSnapshot) => {
        queryClient.setQueryData(detailQueryKey, snapshot);
        if (listQueryKey) {
          queryClient.setQueryData(listQueryKey, (current: RunSnapshot[] | undefined) =>
            upsertRunSnapshot(current, snapshot)
          );
        }
        queryClient.setQueryData(filesQueryKey, snapshot.files);
      };

      const connection = runsRealtime.connect(runId, {
        onOpen: () => {
          setConnected(true);
        },
        onClose: () => {
          rejectPendingCommands("Realtime connection closed before command acknowledgement.");
          setConnected(false);
          setTransport("idle");
        },
        onError: (error) => {
          const pending = pendingCommandsRef.current.shift();
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(error));
          }
        },
        onTransport: (nextTransport) => {
          setTransport(nextTransport);
        },
        onSnapshot: syncSnapshot,
        onEvent: (event) => {
          const current = queryClient.getQueryData<RunSnapshot>(detailQueryKey);
          if (!current) {
            return;
          }

          const next = applyBridgeEventToRunSnapshot(current, event);
          syncSnapshot(next);
        },
        onAck: (_ackRunId, ok) => {
          const pending = pendingCommandsRef.current.shift();
          if (!pending) {
            return;
          }

          clearTimeout(pending.timeoutId);
          if (ok) {
            pending.resolve();
            return;
          }

          pending.reject(new Error("Realtime command was rejected."));
        },
      });

      connectionRef.current = connection;

      return () => {
        connection.close();
        rejectPendingCommands("Realtime connection disposed.");
        if (connectionRef.current === connection) {
          connectionRef.current = null;
        }
        setConnected(false);
        setTransport("idle");
      };
    }, [enabled, queryClient, runId]);

    const enqueueCommand = (
      executor: (connection: RunRealtimeConnection) => void
    ): Promise<void> => {
      const connection = connectionRef.current;
      if (!connection?.isOpen()) {
        return Promise.reject(new Error("Realtime command channel is unavailable."));
      }

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const index = pendingCommandsRef.current.findIndex(
            (item: { timeoutId: ReturnType<typeof setTimeout> }) => item.timeoutId === timeoutId
          );
          if (index !== -1) {
            const [pending] = pendingCommandsRef.current.splice(index, 1);
            pending?.reject(new Error("Realtime acknowledgement timed out."));
          }
        }, 12_000);

        pendingCommandsRef.current.push({
          resolve,
          reject,
          timeoutId,
        });

        try {
          executor(connection);
        } catch (error) {
          const index = pendingCommandsRef.current.findIndex(
            (item: { timeoutId: ReturnType<typeof setTimeout> }) => item.timeoutId === timeoutId
          );
          if (index !== -1) {
            pendingCommandsRef.current.splice(index, 1);
          }
          clearTimeout(timeoutId);
          reject(error instanceof Error ? error : new Error("Failed to send realtime command."));
        }
      });
    };

    return {
      connected,
      transport,
      sendMessage(input: SendRunMessageInput) {
        if (!connectionRef.current?.isOpen()) {
          return false;
        }

        connectionRef.current.sendMessage(input);
        return true;
      },
      sendMessageAwaitAck(input: SendRunMessageInput) {
        return enqueueCommand((connection) => {
          connection.sendMessage(input);
        });
      },
      approve(input: ApproveRunInput) {
        if (!connectionRef.current?.isOpen()) {
          return false;
        }

        connectionRef.current.approve(input);
        return true;
      },
      approveAwaitAck(input: ApproveRunInput) {
        return enqueueCommand((connection) => {
          connection.approve(input);
        });
      },
    } satisfies RunStreamState;
  };
}
