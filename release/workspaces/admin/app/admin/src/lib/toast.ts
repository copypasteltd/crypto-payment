import i18n from "../i18n";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastMeta = {
  code?: string | null;
  requestId?: string | null;
  status?: number | null;
  path?: string | null;
};

export type ToastInput = {
  tone: ToastTone;
  title: string;
  description?: string;
  meta?: ToastMeta;
  durationMs?: number;
  dedupeKey?: string;
  dedupeMs?: number;
};

export type ToastRecord = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastCommand =
  | { type: "add"; toast: ToastRecord }
  | { type: "dismiss"; id: string }
  | { type: "clear" };

type ToastListener = (command: ToastCommand) => void;

const listeners = new Set<ToastListener>();
const pendingCommands: ToastCommand[] = [];
const recentDedupeKeys = new Map<string, number>();
let sequence = 0;

function dispatch(command: ToastCommand) {
  if (listeners.size === 0) {
    pendingCommands.push(command);
    if (pendingCommands.length > 20) pendingCommands.shift();
    return;
  }
  listeners.forEach((listener) => listener(command));
}

function add(input: ToastInput) {
  const now = Date.now();
  const dedupeKey = input.dedupeKey?.trim();
  if (dedupeKey) {
    const lastShownAt = recentDedupeKeys.get(dedupeKey) ?? 0;
    if (now - lastShownAt < (input.dedupeMs ?? 3_000)) return null;
    recentDedupeKeys.set(dedupeKey, now);
  }

  const record: ToastRecord = {
    ...input,
    id: `toast_${now}_${++sequence}`,
    createdAt: now,
    durationMs: input.durationMs ?? (input.tone === "error" ? 12_000 : input.tone === "warning" ? 8_000 : 5_000),
  };
  dispatch({ type: "add", toast: record });
  return record.id;
}

export const toast = {
  show: add,
  success: (title: string, options: Omit<ToastInput, "tone" | "title"> = {}) => add({ ...options, tone: "success", title }),
  error: (title: string, options: Omit<ToastInput, "tone" | "title"> = {}) => add({ ...options, tone: "error", title }),
  warning: (title: string, options: Omit<ToastInput, "tone" | "title"> = {}) => add({ ...options, tone: "warning", title }),
  info: (title: string, options: Omit<ToastInput, "tone" | "title"> = {}) => add({ ...options, tone: "info", title }),
  dismiss: (id: string) => dispatch({ type: "dismiss", id }),
  clear: () => dispatch({ type: "clear" }),
};

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  if (pendingCommands.length) {
    const queued = pendingCommands.splice(0, pendingCommands.length);
    queued.forEach(listener);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUnexpectedError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  toast.error(i18n.t("common:toast.unexpectedError", { defaultValue: "系统发生异常" }), {
    description: context ? `${context}：${message}` : message,
    dedupeKey: `unexpected:${context ?? "global"}:${message}`,
  });
}
