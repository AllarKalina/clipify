import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  clearSessionCookie,
  loadPinnedPlaylistNames,
  loadSessionCookie,
  savePinnedPlaylistNames,
  saveSessionCookie
} from "../src/config";

const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;

afterEach(() => {
  if (originalXdgConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
    return;
  }

  process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
});

describe("cli config", () => {
  test("persists and loads session cookie", () => {
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "clipify-config-"));
    saveSessionCookie("better-auth.session_token=abc123");
    expect(loadSessionCookie()).toBe("better-auth.session_token=abc123");
  });

  test("clears persisted session cookie", () => {
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "clipify-config-"));
    saveSessionCookie("better-auth.session_token=abc123");
    clearSessionCookie();
    expect(loadSessionCookie()).toBeUndefined();
  });

  test("persists and loads pinned playlist names", () => {
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "clipify-config-"));
    savePinnedPlaylistNames(["Na", "Po", "Mud", "Hrr"]);
    expect(loadPinnedPlaylistNames()).toEqual(["Na", "Po", "Mud", "Hrr"]);
  });

  test("preserves pinned playlist names when clearing session cookie", () => {
    process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "clipify-config-"));
    savePinnedPlaylistNames(["Na", "Po", "Mud", "Hrr"]);
    saveSessionCookie("better-auth.session_token=abc123");
    clearSessionCookie();
    expect(loadSessionCookie()).toBeUndefined();
    expect(loadPinnedPlaylistNames()).toEqual(["Na", "Po", "Mud", "Hrr"]);
  });
});
