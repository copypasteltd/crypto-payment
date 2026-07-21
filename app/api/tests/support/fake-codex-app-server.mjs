import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const threadId = "thread_creator_loop";
let turnSequence = 0;
let inputBuffer = "";
let writeQueue = Promise.resolve();

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function completeTurn(turnId) {
  const reportPath = path.join(process.cwd(), "output", "workflow-result.txt");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `creator loop result for ${turnId}\n`,
    "utf8"
  );

  send({ method: "turn/started", params: { thread: { id: threadId }, turn: { id: turnId } } });
  send({
    method: "item/completed",
    params: {
      threadId,
      turnId,
      item: {
        id: `item_${turnId}`,
        type: "agentMessage",
        text: "请提供本次执行所需的业务信息、材料和授权。",
      },
    },
  });
  send({
    method: "turn/completed",
    params: {
      thread: { id: threadId },
      turn: { id: turnId, status: "completed" },
    },
  });
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") return;
  const { id, method } = message;

  if (method === "initialize" && id != null) {
    send({ id, result: { protocolVersion: "fake-app-server/v1" } });
    return;
  }
  if (method === "thread/start" && id != null) {
    send({ id, result: { thread: { id: threadId } } });
    return;
  }
  if (method === "turn/start" && id != null) {
    const turnId = `turn_creator_loop_${++turnSequence}`;
    send({ id, result: { turn: { id: turnId } } });
    await completeTurn(turnId);
    return;
  }
  if (method === "turn/steer" && id != null) {
    send({ id, result: {} });
    return;
  }
  if (method === "turn/interrupt" && id != null) {
    send({ id, result: {} });
  }
}

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk;
  const lines = inputBuffer.split(/\r?\n/);
  inputBuffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    writeQueue = writeQueue
      .then(() => handleMessage(JSON.parse(line)))
      .catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
      });
  }
});
