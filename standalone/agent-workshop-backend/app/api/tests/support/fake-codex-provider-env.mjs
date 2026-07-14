import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targetPath = process.env.TARGET_PATH;

if (!targetPath) {
  console.error("TARGET_PATH is required");
  process.exit(1);
}

const outputPath = path.join(targetPath, "output", "provider-env.json");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      baseUrl: process.env.OPENAI_BASE_URL ?? null,
      model: process.env.OPENAI_MODEL ?? null,
      apiKey: process.env.OPENAI_API_KEY ?? null,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  `fake-codex-provider-env: ${JSON.stringify({
    baseUrl: process.env.OPENAI_BASE_URL ?? null,
    model: process.env.OPENAI_MODEL ?? null,
    apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  })}`
);

process.exit(0);
