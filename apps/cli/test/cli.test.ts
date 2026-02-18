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

  test("does not treat --api value as command when no command is provided", () => {
    const parsed = parseOptions(["--api", "https://clipify.example.com"]);
    expect(parsed.command).toBe("help");
    expect(parsed.options.apiBaseUrl).toBe("https://clipify.example.com");
  });

  test("parses spotify auth callback flags", () => {
    const parsed = parseOptions(["spotify-auth-callback", "--code", "code-1", "--state", "state-1"]);
    expect(parsed.command).toBe("spotify-auth-callback");
    expect(parsed.options.code).toBe("code-1");
    expect(parsed.options.state).toBe("state-1");
  });

  test("parses spotify now playing with cookie option", () => {
    const parsed = parseOptions(["spotify-now-playing", "--cookie", "better-auth.session_token=abc"]);
    expect(parsed.command).toBe("spotify-now-playing");
    expect(parsed.options.sessionCookie).toBe("better-auth.session_token=abc");
  });

  test("parses spotify-login command", () => {
    const parsed = parseOptions(["spotify-login"]);
    expect(parsed.command).toBe("spotify-login");
    expect(parsed.options.openBrowser).toBe(true);
  });

  test("parses --no-open for spotify-login", () => {
    const parsed = parseOptions(["spotify-login", "--no-open"]);
    expect(parsed.command).toBe("spotify-login");
    expect(parsed.options.openBrowser).toBe(false);
  });
});
