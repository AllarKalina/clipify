import type { SpotifyDeviceSummary } from "@clipify/api-client";
import type { HomeSnapshot } from "./home-state";

export function describePlayerDevice(player: Pick<HomeSnapshot, "deviceName" | "deviceType" | "deviceStatus">): string {
  const suffix = player.deviceType ? ` · ${player.deviceType.toLowerCase()}` : "";
  if (player.deviceStatus === "active" && player.deviceName) {
    return `${player.deviceName}${suffix}`;
  }

  if (player.deviceStatus === "available" && player.deviceName) {
    return `${player.deviceName}${suffix} ready elsewhere`;
  }

  if (player.deviceStatus === "restricted" && player.deviceName) {
    return `${player.deviceName}${suffix} restricted`;
  }

  return "No active Spotify device";
}

export function getPlayerDeviceHint(player: Pick<HomeSnapshot, "spotify" | "deviceName" | "deviceStatus">): string {
  if (player.spotify !== "linked") {
    return "Link Spotify to unlock device control.";
  }

  if (player.deviceStatus === "active" && player.deviceName) {
    return `Controlling ${player.deviceName}.`;
  }

  if (player.deviceStatus === "available" && player.deviceName) {
    return `${player.deviceName} is available, but playback is controlled elsewhere. Press [d] to transfer.`;
  }

  if (player.deviceStatus === "restricted" && player.deviceName) {
    return `${player.deviceName} is visible, but Spotify will not allow remote control from Clipify.`;
  }

  return "No active Spotify device. Start playback in Spotify or press [d] to transfer.";
}

export function describeAvailableDevice(device: SpotifyDeviceSummary): string {
  const suffix = device.type ? ` · ${device.type.toLowerCase()}` : "";
  if (device.isRestricted) {
    return `${device.name}${suffix} · restricted`;
  }

  if (device.isActive) {
    return `${device.name}${suffix} · active`;
  }

  return `${device.name}${suffix} · ready`;
}

export function clampDeviceSelection(current: number, deviceCount: number): number {
  if (deviceCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(current, deviceCount - 1));
}
