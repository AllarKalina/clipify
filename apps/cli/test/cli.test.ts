import { describe, expect, test } from "bun:test";
import { parseOptions } from "../src/index";

describe("cli commands", () => {
  test("defaults to app mode", () => {
    const parsed = parseOptions([]);
    expect(parsed.command).toBe("app");
  });

  test("parses custom api url in app mode", () => {
    const parsed = parseOptions(["--api", "https://clipify.example.com"]);
    expect(parsed.command).toBe("app");
    expect(parsed.options.apiBaseUrl).toBe("https://clipify.example.com");
  });

  test("parses auth-set-cookie command", () => {
    const parsed = parseOptions(["auth-set-cookie", "--cookie", "better-auth.session_token=abc"]);
    expect(parsed.command).toBe("auth-set-cookie");
    expect(parsed.options.sessionCookie).toBe("better-auth.session_token=abc");
  });

  test("parses auth-clear-cookie command", () => {
    const parsed = parseOptions(["auth-clear-cookie"]);
    expect(parsed.command).toBe("auth-clear-cookie");
  });

  test("parses no-open flag", () => {
    const parsed = parseOptions(["--no-open"]);
    expect(parsed.command).toBe("app");
    expect(parsed.options.openBrowser).toBe(false);
  });
});
