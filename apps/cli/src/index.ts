#!/usr/bin/env bun

import { createApiClient } from "@clipify/api-client";
import { clearSessionCookie, loadSessionCookie, saveSessionCookie } from "./config";
import { runTerminalApp } from "./terminal-app";

export type CliCommand = "app" | "auth-set-cookie" | "auth-clear-cookie" | "help";

export type CliOptions = {
  apiBaseUrl: string;
  sessionCookie?: string;
  openBrowser: boolean;
};

export function parseOptions(args: string[]): { command: CliCommand; options: CliOptions } {
  const positionals: string[] = [];
  let apiBaseUrl = process.env.CLIPIFY_API_URL || "http://localhost:3000";
  let sessionCookie = process.env.CLIPIFY_SESSION_COOKIE || loadSessionCookie();
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

    if (arg === "--no-open") {
      openBrowser = false;
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
    }
  }

  const commandArg = positionals[0] ?? "app";
  const supportedCommands = new Set<CliCommand>(["auth-set-cookie", "auth-clear-cookie", "help"]);
  const command: CliCommand = supportedCommands.has(commandArg as CliCommand) ? (commandArg as CliCommand) : "app";

  return {
    command,
    options: {
      apiBaseUrl,
      sessionCookie,
      openBrowser
    }
  };
}

function printHelp() {
  console.log(`clipify

Usage:
  clipify [--api <url>] [--cookie <cookie>] [--no-open]
  clipify auth-set-cookie --cookie <cookie>
  clipify auth-clear-cookie
  clipify help

Options:
  --api <url>   Override API base URL (default: CLIPIFY_API_URL or http://localhost:3000)
  --cookie      Raw Cookie header for backend session auth
  --no-open     In app mode, do not auto-open Spotify authorization URL
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

  if (command === "help") {
    printHelp();
    return;
  }

  await runTerminalApp({
    apiBaseUrl: options.apiBaseUrl,
    initialSessionCookie: options.sessionCookie,
    openBrowser: options.openBrowser,
    makeClient(sessionCookie) {
      return createApiClient({
        baseUrl: options.apiBaseUrl,
        sessionCookie
      });
    }
  });
}

if (import.meta.main) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`clipify error: ${message}`);
    process.exit(1);
  });
}
