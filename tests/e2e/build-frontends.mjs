import { spawn } from "node:child_process";

function resolvePnpmBin() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function quoteWindowsArg(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const spawnCommand =
      process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
    const spawnArgs =
      process.platform === "win32"
        ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")]
        : args;

    const child = spawn(spawnCommand, spawnArgs, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

const unreachableApiBaseUrl = "http://127.0.0.1:65535";
const pnpmBin = resolvePnpmBin();

await run(pnpmBin, ["-C", "app/dashboard", "exec", "tsc", "-b"]);
await run(pnpmBin, ["-C", "app/dashboard", "exec", "vite", "build"], {
  VITE_API_BASE_URL: unreachableApiBaseUrl,
});
await run(pnpmBin, ["-C", "app/admin", "exec", "tsc", "-b"]);
await run(pnpmBin, ["-C", "app/admin", "exec", "vite", "build"]);
await run(pnpmBin, ["-C", "app/mobile", "run", "build:h5"], {
  TARO_APP_API_BASE_URL: unreachableApiBaseUrl,
});
