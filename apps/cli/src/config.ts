import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type CliConfig = {
  sessionCookie?: string;
};

function getConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "clipify", "config.json");
}

export function loadSessionCookie(): string | undefined {
  try {
    const raw = readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as CliConfig;
    return parsed.sessionCookie;
  } catch {
    return undefined;
  }
}

export function saveSessionCookie(sessionCookie: string): void {
  const path = getConfigPath();
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ sessionCookie } satisfies CliConfig, null, 2));
}

export function clearSessionCookie(): void {
  try {
    rmSync(getConfigPath(), { force: true });
  } catch {
    // noop
  }
}
