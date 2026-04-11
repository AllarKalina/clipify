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

  if (apiError.code === "RELINK_REQUIRED") {
    return "Playback control needs a fresh Spotify re-link. Press [l].";
  }

  if (apiError.code === "PREMIUM_REQUIRED") {
    return "Spotify Premium is required for this playback control.";
  }

  if (apiError.code === "NO_ACTIVE_DEVICE") {
    return "No active Spotify device. Press [d] to transfer playback, or start playback in Spotify first.";
  }

  if (apiError.code === "DEVICE_RESTRICTED") {
    return "Playback is restricted on the current Spotify device. Pick a different device with [d].";
  }

  if (apiError.status === 403 && apiError.message.includes("fresh Spotify re-link")) {
    return "Playback control needs a fresh Spotify re-link. Press [l].";
  }

  if (apiError.status === 403 && apiError.message.toLowerCase().includes("premium")) {
    return "Spotify Premium is required for this playback control.";
  }

  if (apiError.status === 409 && apiError.message.toLowerCase().includes("no active spotify device")) {
    return "No active Spotify device. Press [d] to transfer playback, or start playback in Spotify first.";
  }

  if (apiError.status === 409 && apiError.message.toLowerCase().includes("restricted")) {
    return "Playback is restricted on the current Spotify device. Pick a different device with [d].";
  }

  return apiError.message.replace(/^Request failed for [^:]+:\s*\d+\s*/u, "") || `${fallbackLabel} failed`;
}
