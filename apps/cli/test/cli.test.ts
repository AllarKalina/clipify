import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { parseOptions } from "../src/index";
import { savePinnedPlaylistNames } from "../src/config";

const originalPinned = process.env.CLIPIFY_PINNED_PLAYLISTS;
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

afterEach(() => {
  if (originalPinned === undefined) {
    delete process.env.CLIPIFY_PINNED_PLAYLISTS;
  } else {
    process.env.CLIPIFY_PINNED_PLAYLISTS = originalPinned;
  }

  if (originalXdgConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
  }
});

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

  test("parses pinned playlist names from env override", () => {
    process.env.CLIPIFY_PINNED_PLAYLISTS = "Na, Po, Mud ,Hrr";
    const parsed = parseOptions([]);
    expect(parsed.options.pinnedPlaylistNames).toEqual(["Na", "Po", "Mud", "Hrr"]);
  });

  test("loads pinned playlist names from config when env override is absent", () => {
    delete process.env.CLIPIFY_PINNED_PLAYLISTS;
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "clipify-config-"));
    savePinnedPlaylistNames(["Na", "Po"]);

    const parsed = parseOptions([]);
    expect(parsed.options.pinnedPlaylistNames).toEqual(["Na", "Po"]);
  });
});
