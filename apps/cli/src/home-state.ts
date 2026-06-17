import type { SpotifyDeviceSummary } from "@clipify/api-client";

export type HomeSnapshot = {
  backend: "connected" | "offline";
  spotify: "linked" | "not-linked" | "relink-required" | "unknown";
  userName: string;
  userEmail: string;
  spotifyDisplayName: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceStatus: "active" | "available" | "restricted" | "none";
  supportsVolume: boolean;
  volumePercent: number;
  playbackState: "playing" | "paused" | "idle";
  shuffleEnabled: boolean;
  repeatMode: "off" | "track" | "context";
  trackName: string;
  artistName: string;
  albumName: string;
  progressMs: number;
  durationMs: number;
  queueStatus: "ready" | "no-device" | "relink-required" | "unavailable";
  queue: Array<{
    trackName: string;
    artistName: string;
    albumName: string;
    type: "track" | "episode" | "unknown";
  }>;
  recentUnavailable: boolean;
  recent: Array<{
    id: string;
    trackName: string;
    artistName: string;
    albumName: string;
    uri: string;
    durationMs: number;
    playedAt: string;
  }>;
  failureReason?: "unauthorized";
  error?: string;
};

export function createInitialHomeSnapshot(): HomeSnapshot {
  return {
    backend: "offline",
    spotify: "unknown",
    userName: "loading",
    userEmail: "",
    spotifyDisplayName: "loading",
    deviceId: "",
    deviceName: "",
    deviceType: "",
    deviceStatus: "none",
    supportsVolume: false,
    volumePercent: 0,
    playbackState: "idle",
    shuffleEnabled: false,
    repeatMode: "off",
    trackName: "",
    artistName: "",
    albumName: "",
    progressMs: 0,
    durationMs: 0,
    queueStatus: "ready",
    queue: [],
    recentUnavailable: false,
    recent: []
  };
}

export function createPendingAuthenticatedHomeSnapshot(): HomeSnapshot {
  return {
    ...createInitialHomeSnapshot(),
    backend: "connected"
  };
}

function pickPrimaryDevice(devices: SpotifyDeviceSummary[]): SpotifyDeviceSummary | null {
  return devices.find((device) => device.isActive) ?? devices.find((device) => !device.isRestricted) ?? devices[0] ?? null;
}

export function reconcilePlayerDevice(snapshot: HomeSnapshot, devices: SpotifyDeviceSummary[]): HomeSnapshot {
  const activeDevice = devices.find((device) => device.isActive) ?? null;
  const primaryDevice = pickPrimaryDevice(devices);

  if (activeDevice) {
    return {
      ...snapshot,
      deviceId: activeDevice.id,
      deviceName: activeDevice.name,
      deviceType: activeDevice.type,
      deviceStatus: activeDevice.isRestricted ? "restricted" : "active",
      supportsVolume: activeDevice.supportsVolume,
      volumePercent: activeDevice.volumePercent
    };
  }

  if (!primaryDevice) {
    return {
      ...snapshot,
      deviceId: "",
      deviceName: "",
      deviceType: "",
      deviceStatus: "none",
      supportsVolume: false,
      volumePercent: 0
    };
  }

  return {
    ...snapshot,
    deviceId: primaryDevice.id,
    deviceName: primaryDevice.name,
    deviceType: primaryDevice.type,
    deviceStatus: primaryDevice.isRestricted ? "restricted" : "available",
    supportsVolume: primaryDevice.supportsVolume,
    volumePercent: primaryDevice.volumePercent
  };
}

export function shouldTickPlayback(snapshot: HomeSnapshot): boolean {
  return snapshot.backend === "connected" && snapshot.spotify === "linked" && snapshot.playbackState === "playing" && snapshot.durationMs > 0;
}

export function applyProgressTick(snapshot: HomeSnapshot, elapsedMs: number): HomeSnapshot {
  if (!shouldTickPlayback(snapshot) || elapsedMs <= 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    progressMs: Math.min(snapshot.durationMs, snapshot.progressMs + elapsedMs)
  };
}

export function shouldBackgroundRefresh(snapshot: HomeSnapshot): boolean {
  return snapshot.backend === "connected" && snapshot.spotify === "linked" && snapshot.playbackState === "playing";
}
