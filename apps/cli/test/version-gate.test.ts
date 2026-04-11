import { describe, expect, test } from "bun:test";
import { checkCliVersionGate } from "../src/version-gate";

describe("checkCliVersionGate", () => {
  test("blocks when CLI version is below minimum supported", async () => {
    const result = await checkCliVersionGate(
      {
        async getVersion() {
          return {
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.2.0",
            latestCliVersion: "0.2.1"
          };
        }
      },
      "0.1.0"
    );

    expect(result.blocked).toBeTrue();
    expect(result.message).toContain("Minimum supported version is 0.2.0");
  });

  test("shows advisory when CLI is below latest but above minimum", async () => {
    const result = await checkCliVersionGate(
      {
        async getVersion() {
          return {
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.1.0",
            latestCliVersion: "0.2.0"
          };
        }
      },
      "0.1.1"
    );

    expect(result.blocked).toBeFalse();
    expect(result.message).toContain("A newer clipify CLI is available");
  });

  test("returns empty message when CLI is up to date", async () => {
    const result = await checkCliVersionGate(
      {
        async getVersion() {
          return {
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.1.0",
            latestCliVersion: "0.1.0"
          };
        }
      },
      "0.1.0"
    );

    expect(result).toEqual({
      blocked: false,
      message: ""
    });
  });
});
