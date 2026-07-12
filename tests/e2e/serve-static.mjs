import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const values = {
    root: "",
    port: 4173,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--root" && next) {
      values.root = path.resolve(next);
      index += 1;
      continue;
    }

    if (current === "--port" && next) {
      values.port = Number(next);
      index += 1;
    }
  }

  if (!values.root) {
    throw new Error("Missing required --root argument.");
  }

  return values;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function ensureRoot(rootPath) {
  if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
    throw new Error(`Static root does not exist: ${rootPath}`);
  }

  await mkdir(rootPath, { recursive: true });
}

async function startServer(rootPath, port) {
  const indexHtmlPath = path.join(rootPath, "index.html");
  const indexHtml = await readFile(indexHtmlPath);

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
    const candidatePath = path.resolve(rootPath, `.${normalizedPath}`);
    const safePrefix = `${rootPath}${path.sep}`;

    if (
      candidatePath !== indexHtmlPath &&
      !candidatePath.startsWith(safePrefix)
    ) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
      response.writeHead(200, { "content-type": contentTypeFor(candidatePath) });
      createReadStream(candidatePath).pipe(response);
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(indexHtml);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const close = async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  process.on("SIGINT", async () => {
    await close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await close();
    process.exit(0);
  });

  console.log(`Static server ready: http://127.0.0.1:${port} -> ${rootPath}`);
}

const { root, port } = parseArgs(process.argv.slice(2));
await ensureRoot(root);
await startServer(root, port);
