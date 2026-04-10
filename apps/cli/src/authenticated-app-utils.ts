import { ApiClientError } from "@clipify/api-client";
import type { HomeSnapshot } from "./home-state";

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function nextRepeatMode(mode: HomeSnapshot["repeatMode"]): HomeSnapshot["repeatMode"] {
  if (mode === "off") {
    return "context";
  }

  if (mode === "context") {
    return "track";
  }

  return "off";
}

export function getPlaybackFailureMessage(error: unknown, fallbackLabel: string): string {
  const apiError = error as ApiClientError;
  if (apiError?.name !== "ApiClientError") {
    return `${fallbackLabel} failed: ${toMessage(error)}`;
  }

  if (apiError.status === 403 && apiError.message.includes("fresh Spotify re-link")) {
    return "Playback control needs a fresh Spotify re-link. Press [l].";
  }

  return apiError.message.replace(/^Request failed for [^:]+:\s*\d+\s*/u, "") || `${fallbackLabel} failed`;
}
