import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targetPath = process.env.TARGET_PATH;
const outputsPath = process.env.OUTPUTS_PATH;

if (!targetPath) {
  console.error("TARGET_PATH is required");
  process.exit(1);
}

let promptReceived = false;
let completed = false;
let promptPhaseClosed = false;
let promptPhaseTimer = null;
let stdinBuffer = "";
let stdinQueue = Promise.resolve();

async function ensureBaseFiles() {
  const reportPath = path.join(targetPath, "output", "report.txt");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, "system smoke report\n", "utf8");
  console.log("fake-codex: report prepared");
}

async function emitCompletionArtifacts(userText) {
  const notePath = path.join(targetPath, "notes", "from-user.txt");
  await mkdir(path.dirname(notePath), { recursive: true });
  await writeFile(notePath, `${userText}\n`, "utf8");

  if (outputsPath) {
    const artifactPath = path.join(outputsPath, "artifact-note.txt");
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, "artifact from local-process smoke\n", "utf8");
  }

  console.log(`fake-codex: user message consumed -> ${userText}`);
}

async function finishSuccessfully() {
  if (completed) {
    return;
  }

  completed = true;
  console.log("fake-codex: completed");
  await new Promise((resolve) => setTimeout(resolve, 300));
  process.exit(0);
}

console.log("fake-codex: boot");

const fallbackTimer = setTimeout(() => {
  void finishSuccessfully();
}, 10_000);
fallbackTimer.unref?.();

function schedulePromptPhaseClose() {
  if (promptPhaseTimer) {
    clearTimeout(promptPhaseTimer);
  }

  promptPhaseTimer = setTimeout(() => {
    promptPhaseClosed = true;
    promptPhaseTimer = null;
  }, 250);
  promptPhaseTimer.unref?.();
}

async function consumeLine(line) {
  const text = line.trim();
  if (!text) {
    return;
  }

  if (!promptReceived) {
    promptReceived = true;
    await ensureBaseFiles();
    console.log("fake-codex: prompt acknowledged");
    schedulePromptPhaseClose();
    return;
  }

  if (!promptPhaseClosed) {
    schedulePromptPhaseClose();
    return;
  }

  await emitCompletionArtifacts(text);
  await finishSuccessfully();
}

function enqueueLine(line) {
  stdinQueue = stdinQueue
    .catch(() => undefined)
    .then(() => consumeLine(line))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    });
}

function drainStdinBuffer() {
  const segments = stdinBuffer.split(/[\r\n]+/);
  stdinBuffer = segments.pop() ?? "";

  for (const segment of segments) {
    enqueueLine(segment);
  }
}

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk;
  drainStdinBuffer();
});

process.stdin.on("end", () => {
  if (stdinBuffer.trim()) {
    enqueueLine(stdinBuffer);
    stdinBuffer = "";
  }
});

process.stdin.on("close", () => {
  if (promptPhaseTimer) {
    clearTimeout(promptPhaseTimer);
    promptPhaseTimer = null;
  }
  if (!completed) {
    process.exit(0);
  }
});
