import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { askJev, createJevClient } from "./jev-client.mjs";
import { startCodexProxy } from "./proxy.mjs";

const PROVIDER = "openai";

export function loadEnv({ cwd = process.cwd(), home = homedir() } = {}) {
  for (const file of [
    join(cwd, ".env"),
    join(home, ".jev-codex.env"),
    join(home, ".jev-router.env"),
  ]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing local secret files are valid; the process environment may already contain a key.
    }
  }
}

export function resolveCodex() {
  const windows = process.platform === "win32";
  const extensions = windows ? [".exe", ".ps1", ".cmd", ".bat"] : [""];
  for (const directory of (process.env.PATH ?? "").split(windows ? ";" : ":")) {
    if (!directory) continue;
    for (const extension of extensions) {
      const file = join(directory.replace(/^"|"$/g, ""), `codex${extension}`);
      try {
        accessSync(file, constants.F_OK);
        if (/\.ps1$/i.test(file)) {
          return { file: "powershell.exe", prefix: ["-NoProfile", "-File", file], shell: false };
        }
        return { file, prefix: [], shell: /\.(cmd|bat)$/i.test(file) };
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return null;
}

export function hasExplicitModel(args = []) {
  return args.some(
    (arg) => arg === "--model" || arg === "-m" || arg.startsWith("--model="),
  );
}

export function codexArgs(baseURL, args = []) {
  return [
    "--config",
    `model_provider="${PROVIDER}"`,
    "--config",
    `openai_base_url="${baseURL}"`,
    ...args,
  ];
}

export async function runCodex({ spawnImpl = spawn } = {}) {
  loadEnv();
  const command = resolveCodex();
  if (!command) {
    process.stderr.write("[codex-jev] OpenAI Codex is not installed or is not on PATH.\n");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.JEV_API_KEY ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "[codex-jev] no Jev API key found; running with routing fallback. " +
      "Set JEV_API_KEY in ~/.jev-codex.env to enable routing.\n",
    );
  }

  const userArgs = process.argv.slice(2);
  const jev = apiKey ? createJevClient({ apiKey, baseURL: process.env.JEV_BASE_URL }) : null;
  const proxy = await startCodexProxy({
    route: (input) => askJev({ ...input, client: jev }),
    routeModels: !hasExplicitModel(userArgs),
  });
  const args = codexArgs(`http://${proxy.host}:${proxy.port}`, userArgs);
  const child = spawnImpl(command.file, [...command.prefix, ...args], {
    stdio: "inherit",
    shell: command.shell,
    env: process.env,
  });

  const cleanup = () => proxy.close().catch(() => {});
  child.on("error", (error) => {
    cleanup();
    process.stderr.write(`[codex-jev] could not start Codex: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    cleanup();
    process.exitCode = signal ? 1 : (code ?? 0);
  });
}
