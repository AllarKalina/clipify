import type { SpotifyDeviceSummary } from "@clipify/api-client";
import type { HomeSnapshot } from "./home-state";

export function describePlayerDevice(player: Pick<HomeSnapshot, "deviceName" | "deviceType" | "deviceStatus">): string {
  const suffix = player.deviceType ? ` · ${player.deviceType.toLowerCase()}` : "";
  if (player.deviceStatus === "active" && player.deviceName) {
    return `${player.deviceName}${suffix}`;
  }

  if (player.deviceStatus === "available" && player.deviceName) {
    return `${player.deviceName}${suffix} ready`;
  }

  if (player.deviceStatus === "restricted" && player.deviceName) {
    return `${player.deviceName}${suffix} restricted`;
  }

  return "No Spotify device available";
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
