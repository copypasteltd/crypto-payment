import test from "node:test";
import assert from "node:assert/strict";
import { createRunsRealtimeClient } from "../dist/index.js";

class MockSocket {
  constructor() {
    this.readyState = 0;
    this.sent = [];
    this.listeners = new Map();
    this.closed = [];
  }

  addEventListener(type, listener) {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type, listener) {
    const bucket = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      bucket.filter((entry) => entry !== listener)
    );
  }

  send(data) {
    this.sent.push(data);
  }

  close(code, reason) {
    this.readyState = 3;
    this.closed.push({ code: code ?? null, reason: reason ?? null });
  }

  emit(type, event = {}) {
    if (type === "open") {
      this.readyState = 1;
    }
    if (type === "close") {
      this.readyState = 3;
    }

    const bucket = this.listeners.get(type) ?? [];
    for (const listener of bucket) {
      listener(event);
    }
  }
}

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.closeCalls = 0;
  }

  addEventListener(type, listener) {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type, listener) {
    const bucket = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      bucket.filter((entry) => entry !== listener)
    );
  }

  close() {
    this.readyState = 2;
    this.closeCalls += 1;
  }

  emit(type, event = {}) {
    if (type === "open") {
      this.readyState = 1;
    }

    const bucket = this.listeners.get(type) ?? [];
    for (const listener of bucket) {
      listener(event);
    }
  }
}

function sampleSnapshot() {
  return {
    run: {
      runId: "run_00000001",
      workspaceId: "wsp_00000001",
      taskVersionId: "tsv_00000001",
      sessionVersionId: "sev_00000001",
      requestedByUserId: null,
      title: "Realtime smoke",
      targetPath: "/workspace/realtime-smoke",
      entrySurface: "dashboard",
      catalogMetadata: null,
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
    },
    runtime: {
      launchMode: "local-process",
      containerName: null,
      startedAt: "2026-07-09T00:00:01.000Z",
      readyAt: "2026-07-09T00:00:02.000Z",
      finishedAt: null,
      exitCode: null,
      exitSignal: null,
    },
    messages: [],
    files: [],
    artifacts: [],
    approvals: [],
  };
}

test("runs realtime client uses websocket transport and forwards commands", () => {
  const socket = new MockSocket();
  let receivedUrl = null;
  const seen = {
    transport: [],
    opened: 0,
    ack: [],
    events: [],
    snapshots: [],
    errors: [],
    closed: 0,
  };

  const client = createRunsRealtimeClient({
    baseUrl: "http://api.example.test",
    getAccessToken: () => "access-token-123",
    socketFactory: (url) => {
      receivedUrl = url;
      return socket;
    },
  });

  const connection = client.connect("run_00000001", {
    onTransport: (transport) => seen.transport.push(transport),
    onOpen: () => {
      seen.opened += 1;
    },
    onAck: (runId, ok) => seen.ack.push({ runId, ok }),
    onEvent: (event) => seen.events.push(event),
    onSnapshot: (snapshot) => seen.snapshots.push(snapshot),
    onError: (error) => seen.errors.push(error),
    onClose: () => {
      seen.closed += 1;
    },
  });

  assert.equal(
    receivedUrl,
    "ws://api.example.test/ws/runs/run_00000001?accessToken=access-token-123"
  );

  socket.emit("open");
  assert.deepEqual(seen.transport, ["ws"]);
  assert.equal(seen.opened, 1);
  assert.equal(connection.isOpen(), true);

  assert.deepEqual(JSON.parse(socket.sent[0]), {
    type: "runs.subscribe",
    runId: "run_00000001",
  });

  socket.emit("message", {
    data: JSON.stringify({
      type: "runs.ack",
      runId: "run_00000001",
      ok: true,
    }),
  });
  socket.emit("message", {
    data: JSON.stringify({
      type: "runs.snapshot",
      payload: sampleSnapshot(),
    }),
  });
  socket.emit("message", {
    data: JSON.stringify({
      type: "runs.event",
      payload: {
        type: "heartbeat",
        runId: "run_00000001",
        occurredAt: "2026-07-09T00:00:03.000Z",
      },
    }),
  });

  assert.deepEqual(seen.ack, [{ runId: "run_00000001", ok: true }]);
  assert.equal(seen.snapshots.length, 1);
  assert.equal(seen.events.length, 1);
  assert.deepEqual(seen.errors, []);

  connection.sendMessage({
    text: "Please continue",
    attachments: [],
  });
  connection.approve({
    approved: true,
    note: "approved",
  });
  connection.cancel("stop now");

  assert.deepEqual(JSON.parse(socket.sent[1]), {
    type: "runs.sendMessage",
    runId: "run_00000001",
    payload: {
      text: "Please continue",
      attachments: [],
      slotValues: [],
    },
  });
  assert.deepEqual(JSON.parse(socket.sent[2]), {
    type: "runs.approve",
    runId: "run_00000001",
    payload: {
      approved: true,
      note: "approved",
    },
  });
  assert.deepEqual(JSON.parse(socket.sent[3]), {
    type: "runs.cancel",
    runId: "run_00000001",
    reason: "stop now",
  });

  connection.close();
  assert.equal(connection.isOpen(), false);
  assert.deepEqual(socket.closed.at(-1), {
    code: 1000,
    reason: "client.close",
  });
  assert.equal(seen.closed, 0);
});

test("runs realtime client falls back to sse when websocket fails before opening", () => {
  const socket = new MockSocket();
  let eventSource = null;
  const seen = {
    transport: [],
    opened: 0,
    errors: [],
    events: [],
  };

  const client = createRunsRealtimeClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token-xyz",
    socketFactory: () => socket,
    eventSourceFactory: (url) => {
      eventSource = new MockEventSource(url);
      return eventSource;
    },
  });

  const connection = client.connect("run_00000001", {
    onTransport: (transport) => seen.transport.push(transport),
    onOpen: () => {
      seen.opened += 1;
    },
    onError: (error) => seen.errors.push(error),
    onEvent: (event) => seen.events.push(event),
  });

  socket.emit("error");

  assert.ok(eventSource);
  assert.deepEqual(socket.closed.at(-1), {
    code: 1000,
    reason: "fallback.sse",
  });

  eventSource.emit("open");
  eventSource.emit("runs.event", {
    data: JSON.stringify({
      type: "runs.event",
      payload: {
        type: "heartbeat",
        runId: "run_00000001",
        occurredAt: "2026-07-09T00:00:03.000Z",
      },
    }),
  });

  assert.deepEqual(seen.transport, ["sse"]);
  assert.equal(seen.opened, 1);
  assert.equal(connection.isOpen(), false);
  assert.equal(seen.events.length, 1);
  assert.deepEqual(seen.errors, []);
  assert.equal(
    eventSource.url,
    "https://api.example.test/v1/runs/run_00000001/stream?accessToken=token-xyz"
  );

  connection.close();
  assert.equal(eventSource.closeCalls, 1);
});
