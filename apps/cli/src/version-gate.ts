import type { ApiClient } from "@clipify/api-client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FALLBACK_CLI_VERSION = "0.1.0";

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemver(input: string): ParsedSemver | null {
  const trimmed = input.trim();
  const core = trimmed.split("-")[0];
  const match = core.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemver(left: string, right: string): number {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);

  if (!leftParsed || !rightParsed) {
    return left.localeCompare(right);
  }

  if (leftParsed.major !== rightParsed.major) {
    return leftParsed.major - rightParsed.major;
  }

  if (leftParsed.minor !== rightParsed.minor) {
    return leftParsed.minor - rightParsed.minor;
  }

  return leftParsed.patch - rightParsed.patch;
}

function readCliVersionFromPackageJson(): string | undefined {
  try {
    const packageJsonPath = join(import.meta.dir, "..", "package.json");
    const packageJsonRaw = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonRaw) as { version?: unknown };

    if (typeof packageJson.version !== "string") {
      return undefined;
    }

    const version = packageJson.version.trim();
    return version ? version : undefined;
  } catch {
    return undefined;
  }
}

export function getCliVersion(): string {
  const npmVersion = process.env.npm_package_version?.trim();
  if (npmVersion) {
    return npmVersion;
  }

  return readCliVersionFromPackageJson() ?? FALLBACK_CLI_VERSION;
}

export type CliVersionGateResult = {
  blocked: boolean;
  message: string;
};

export async function checkCliVersionGate(
  client: Pick<ApiClient, "getVersion">,
  cliVersion = getCliVersion()
): Promise<CliVersionGateResult> {
  const versionMetadata = await client.getVersion();

  if (compareSemver(cliVersion, versionMetadata.minCliVersion) < 0) {
    return {
      blocked: true,
      message: `CLI ${cliVersion} is unsupported. Minimum supported version is ${versionMetadata.minCliVersion}. Please upgrade clipify.`
    };
  }

  if (compareSemver(cliVersion, versionMetadata.latestCliVersion) < 0) {
    return {
      blocked: false,
      message: `A newer clipify CLI is available (${versionMetadata.latestCliVersion}). You are on ${cliVersion}.`
    };
  }

  return {
    blocked: false,
    message: ""
  };
}
