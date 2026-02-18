#!/usr/bin/env bun

import { createApiClient } from "@clipify/api-client";

export type CliCommand = "help" | "doctor" | "public-example";

export type CliOptions = {
  apiBaseUrl: string;
};

export function parseOptions(args: string[]): { command: CliCommand; options: CliOptions } {
  const apiIndex = args.findIndex((value) => value === "--api");
  const apiBaseUrl =
    apiIndex >= 0 && args[apiIndex + 1] ? args[apiIndex + 1]! : process.env.CLIPIFY_API_URL || "http://localhost:3000";

  const commandArg = args.find((value) => !value.startsWith("--")) ?? "help";

  const command: CliCommand =
    commandArg === "doctor" || commandArg === "public-example" ? commandArg : "help";

  return {
    command,
    options: {
      apiBaseUrl
    }
  };
}

function printHelp() {
  console.log(`clipify

Usage:
  clipify doctor [--api <url>]
  clipify public-example [--api <url>]

Options:
  --api <url>   Override API base URL (default: CLIPIFY_API_URL or http://localhost:3000)
`);
}

async function run() {
  const { command, options } = parseOptions(Bun.argv.slice(2));
  const client = createApiClient({ baseUrl: options.apiBaseUrl });

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

  const example = await client.getPublicExample();
  console.log(JSON.stringify(example));
}

if (import.meta.main) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`clipify error: ${message}`);
    process.exit(1);
  });
}
