const heartbeat = setInterval(() => {
  console.log("fake-codex-governance: heartbeat");
}, 2_000);
heartbeat.unref?.();

let stdinBuffer = "";

function logLine(line) {
  const text = line.trim();
  if (!text) {
    return;
  }

  console.log(`fake-codex-governance: input -> ${text}`);
}

function flushBuffer() {
  const segments = stdinBuffer.split(/[\r\n]+/);
  stdinBuffer = segments.pop() ?? "";
  for (const segment of segments) {
    logLine(segment);
  }
}

function shutdown(code = 0) {
  clearInterval(heartbeat);
  setTimeout(() => {
    process.exit(code);
  }, 50).unref?.();
}

console.log("fake-codex-governance: boot");

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk;
  flushBuffer();
});
process.stdin.on("end", () => {
  if (stdinBuffer.trim()) {
    logLine(stdinBuffer);
    stdinBuffer = "";
  }
});
process.stdin.on("close", () => {
  if (stdinBuffer.trim()) {
    logLine(stdinBuffer);
    stdinBuffer = "";
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

setInterval(() => {
  // Keep the fake codex runtime alive until the test cancels the run.
}, 60_000);
