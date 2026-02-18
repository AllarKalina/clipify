import { describe, expect, test } from "bun:test";
import { parseOptions } from "../src/index";

describe("cli commands", () => {
  test("parses doctor command and custom api url", () => {
    const parsed = parseOptions(["doctor", "--api", "https://clipify.example.com"]);
    expect(parsed.command).toBe("doctor");
    expect(parsed.options.apiBaseUrl).toBe("https://clipify.example.com");
  });

  test("defaults to help for unknown command", () => {
    const parsed = parseOptions(["unknown-cmd"]);
    expect(parsed.command).toBe("help");
  });
});
