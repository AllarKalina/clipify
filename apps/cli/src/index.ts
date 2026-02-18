#!/usr/bin/env bun

import { ApiClientError, createApiClient } from "@clipify/api-client";
import { clearSessionCookie, loadSessionCookie, saveSessionCookie } from "./config";

export type CliCommand =
  | "help"
  | "doctor"
  | "public-example"
  | "spotify-login"
  | "spotify-auth-start"
  | "spotify-auth-callback"
  | "spotify-now-playing"
  | "spotify-status"
  | "auth-set-cookie"
  | "auth-clear-cookie";

export type CliOptions = {
  apiBaseUrl: string;
  sessionCookie?: string;
  code?: string;
  state?: string;
  completeUrl?: string;
  openBrowser: boolean;
};

export function parseOptions(args: string[]): { command: CliCommand; options: CliOptions } {
  const positionals: string[] = [];
  let apiBaseUrl = process.env.CLIPIFY_API_URL || "http://localhost:3000";
  let sessionCookie = process.env.CLIPIFY_SESSION_COOKIE || loadSessionCookie();
  let code: string | undefined;
  let state: string | undefined;
  let completeUrl: string | undefined;
  let openBrowser = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--api" && args[index + 1]) {
      apiBaseUrl = args[index + 1]!;
      index += 1;
      continue;
    }

    if (arg === "--cookie" && args[index + 1]) {
      sessionCookie = args[index + 1]!;
      index += 1;
      continue;
    }

    if (arg === "--code" && args[index + 1]) {
      code = args[index + 1]!;
      index += 1;
      continue;
    }

    if (arg === "--state" && args[index + 1]) {
      state = args[index + 1]!;
      index += 1;
      continue;
    }

    if (arg === "--complete-url" && args[index + 1]) {
      completeUrl = args[index + 1]!;
      index += 1;
      continue;
    }

    if (arg === "--no-open") {
      openBrowser = false;
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
    }
  }

  const commandArg = positionals[0] ?? "help";
  const supportedCommands = new Set<CliCommand>([
    "doctor",
    "public-example",
    "spotify-login",
    "spotify-auth-start",
    "spotify-auth-callback",
    "spotify-now-playing",
    "spotify-status",
    "auth-set-cookie",
    "auth-clear-cookie"
  ]);
  const command: CliCommand = supportedCommands.has(commandArg as CliCommand) ? (commandArg as CliCommand) : "help";

  return {
    command,
    options: {
      apiBaseUrl,
      sessionCookie,
      code,
      state,
      completeUrl,
      openBrowser
    }
  };
}

export function parseSpotifyCallbackUrl(redirectUrl: string): { code: string; state: string } {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    throw new Error("complete-url must include both code and state query parameters");
  }

  return { code, state };
}

function openUrl(url: string): boolean {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const processResult = Bun.spawnSync(command, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    });
    return processResult.exitCode === 0;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`clipify

Usage:
  clipify doctor [--api <url>]
  clipify public-example [--api <url>]
  clipify spotify-login [--api <url>] [--cookie <cookie>] [--no-open] [--complete-url <url>]
  clipify spotify-auth-start [--api <url>] [--cookie <cookie>]
  clipify spotify-auth-callback --code <code> --state <state> [--api <url>] [--cookie <cookie>]
  clipify spotify-now-playing [--api <url>] [--cookie <cookie>]
  clipify spotify-status [--api <url>] [--cookie <cookie>]
  clipify auth-set-cookie --cookie <cookie>
  clipify auth-clear-cookie

Options:
  --api <url>   Override API base URL (default: CLIPIFY_API_URL or http://localhost:3000)
  --cookie      Raw Cookie header (default: CLIPIFY_SESSION_COOKIE, then persisted config)
  --code        Spotify callback authorization code
  --state       Spotify callback state
  --complete-url Full redirect URL containing ?code=...&state=...
  --no-open     Do not auto-open Spotify authorization URL
`);
}

async function run() {
  const { command, options } = parseOptions(Bun.argv.slice(2));
  if (command === "auth-set-cookie") {
    if (!options.sessionCookie) {
      throw new Error("auth-set-cookie requires --cookie");
    }

    saveSessionCookie(options.sessionCookie);
    console.log("cookie=saved");
    return;
  }

  if (command === "auth-clear-cookie") {
    clearSessionCookie();
    console.log("cookie=cleared");
    return;
  }

  const client = createApiClient({ baseUrl: options.apiBaseUrl, sessionCookie: options.sessionCookie });

  if (command === "help") {
    printHelp();
    return;
  }

  if (command === "doctor") {
    const version = await client.getVersion();
    const line = [
      `api=${version.apiVersion}`,
      `app=${version.appName}`,
      `minCli=${version.minCliVersion}`,
      `latestCli=${version.latestCliVersion}`
    ].join(" ");

    console.log(line);
    return;
  }

  if (command === "public-example") {
    const example = await client.getPublicExample();
    console.log(JSON.stringify(example));
    return;
  }

  if (command === "spotify-auth-start") {
    const result = await client.startSpotifyAuthorization();
    console.log(`authorizeUrl=${result.authorizeUrl}`);
    console.log(`state=${result.state}`);
    return;
  }

  if (command === "spotify-login") {
    if (options.completeUrl) {
      const parsed = parseSpotifyCallbackUrl(options.completeUrl);
      const result = await client.completeSpotifyAuthorization(parsed);
      console.log(`linked=${result.linked} userId=${result.userId}`);
      return;
    }

    const result = await client.startSpotifyAuthorization();
    const opened = options.openBrowser ? openUrl(result.authorizeUrl) : false;
    console.log(`authorizeUrl=${result.authorizeUrl}`);
    console.log(`state=${result.state}`);
    console.log(
      `next: clipify spotify-auth-callback --code "<code>" --state "${result.state}" --cookie "<your-session-cookie>" --api ${options.apiBaseUrl}`
    );

    if (options.openBrowser) {
      console.log(opened ? "browser=open" : "browser=failed-to-open");
    }

    return;
  }

  if (command === "spotify-auth-callback") {
    if (!options.code || !options.state) {
      throw new Error("spotify-auth-callback requires --code and --state");
    }

    const result = await client.completeSpotifyAuthorization({
      code: options.code,
      state: options.state
    });

    console.log(`linked=${result.linked} userId=${result.userId}`);
    return;
  }

  if (command === "spotify-status") {
    await client.getMe();
    try {
      const current = await client.getSpotifyCurrentlyPlaying();
      if (!current.isPlaying) {
        console.log("spotify=linked playback=idle");
        return;
      }

      console.log(`spotify=linked playback=playing track="${current.trackName}" artist="${current.artistName}"`);
      return;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        console.log("spotify=not-linked");
        return;
      }

      throw error;
    }
  }

  const current = await client.getSpotifyCurrentlyPlaying();
  if (!current.isPlaying) {
    console.log("nothing-playing");
    return;
  }
  console.log(`${current.trackName} - ${current.artistName} (${current.albumName})`);
}

if (import.meta.main) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`clipify error: ${message}`);
    process.exit(1);
  });
}
