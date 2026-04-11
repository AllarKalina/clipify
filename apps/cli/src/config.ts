import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type CliConfig = {
  sessionCookie?: string;
  pinnedPlaylistNames?: string[];
};

function getConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "clipify", "config.json");
}

function readConfig(): CliConfig {
  try {
    const raw = readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

function writeConfig(next: CliConfig): void {
  const path = getConfigPath();
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2));
}

export function loadSessionCookie(): string | undefined {
  return readConfig().sessionCookie;
}

export function saveSessionCookie(sessionCookie: string): void {
  const current = readConfig();
  writeConfig({
    ...current,
    sessionCookie
  } satisfies CliConfig);
}

export function loadPinnedPlaylistNames(): string[] {
  const names = readConfig().pinnedPlaylistNames;
  if (!Array.isArray(names)) {
    return [];
  }

  return names.filter((name): name is string => typeof name === "string").map((name) => name.trim()).filter(Boolean);
}

export function savePinnedPlaylistNames(names: string[]): void {
  const current = readConfig();
  const nextNames = names.map((name) => name.trim()).filter(Boolean);
  writeConfig({
    ...current,
    pinnedPlaylistNames: nextNames
  } satisfies CliConfig);
}

export function clearSessionCookie(): void {
  try {
    const current = readConfig();
    if (current.pinnedPlaylistNames?.length) {
      writeConfig({ pinnedPlaylistNames: current.pinnedPlaylistNames } satisfies CliConfig);
      return;
    }

    rmSync(getConfigPath(), { force: true });
  } catch {
    // noop
  }
}
