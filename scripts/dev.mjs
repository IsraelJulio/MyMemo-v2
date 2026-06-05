import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCli = process.env.npm_execpath;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpmScript(cwd) {
  if (npmCli) {
    return spawn(process.execPath, [npmCli, "run", "dev"], { cwd, stdio: "pipe" });
  }

  return spawn(npm, ["run", "dev"], {
    cwd,
    stdio: "pipe",
    shell: process.platform === "win32"
  });
}

const children = [
  ["api", resolve(root, "backend")],
  ["web", resolve(root, "frontend")]
].map(([name, cwd]) => {
  let child;
  try {
    child = runNpmScript(cwd);
  } catch (error) {
    process.stderr.write(`[${name}] failed to start: ${error.message}\n`);
    process.exitCode = 1;
    return null;
  }

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("error", (error) => {
    process.stderr.write(`[${name}] failed to start: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (code) process.exitCode = code;
  });
  return child;
}).filter(Boolean);

function stop() {
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
