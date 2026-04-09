import type { ApiClient, ApiClientError } from "@clipify/api-client";

export type HomeSnapshot = {
  backend: "connected" | "offline";
  spotify: "linked" | "not-linked" | "unknown";
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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readQueueState(client: ApiClient): Promise<Pick<HomeSnapshot, "queue" | "queueStatus">> {
  try {
    return {
      queue: (await client.getSpotifyQueue()).items,
      queueStatus: "ready"
    };
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.name === "ApiClientError" && apiError.status === 403) {
      return { queue: [], queueStatus: "relink-required" };
    }

    if (apiError?.name === "ApiClientError" && apiError.status === 409) {
      return { queue: [], queueStatus: "no-device" };
    }

    return { queue: [], queueStatus: "unavailable" };
  }
}

type RefreshPlayerSnapshotOptions = {
  includeQueue?: boolean;
};

export async function refreshPlayerSnapshot(
  client: ApiClient,
  current: HomeSnapshot,
  options: RefreshPlayerSnapshotOptions = {}
): Promise<HomeSnapshot> {
  try {
    const currentlyPlaying = await client.getSpotifyCurrentlyPlaying();
    const queueState = options.includeQueue ? await readQueueState(client) : { queue: current.queue, queueStatus: current.queueStatus };

    return {
      ...current,
      backend: "connected",
      spotify: "linked",
      deviceId: currentlyPlaying.deviceId,
      deviceName: currentlyPlaying.deviceName,
      deviceType: currentlyPlaying.deviceType,
      deviceStatus: currentlyPlaying.deviceStatus,
      supportsVolume: currentlyPlaying.supportsVolume,
      volumePercent: currentlyPlaying.volumePercent,
      playbackState: currentlyPlaying.playbackState,
      shuffleEnabled: currentlyPlaying.shuffleEnabled,
      repeatMode: currentlyPlaying.repeatMode,
      trackName: currentlyPlaying.trackName,
      artistName: currentlyPlaying.artistName,
      albumName: currentlyPlaying.albumName,
      progressMs: currentlyPlaying.progressMs,
      durationMs: currentlyPlaying.durationMs,
      queue: queueState.queue,
      queueStatus: queueState.queueStatus,
      error: undefined,
      failureReason: undefined
    };
  } catch (error) {
    const apiError = error as ApiClientError;
    if (apiError?.name === "ApiClientError" && apiError.status === 401) {
      return {
        ...current,
        failureReason: "unauthorized",
        error: toMessage(error)
      };
    }

    return {
      ...current,
      backend: "offline",
      error: toMessage(error)
    };
  }
}

export async function computeHomeSnapshot(client: ApiClient): Promise<HomeSnapshot> {
  try {
    const me = await client.getMe();
    const authStatus = await client.getSpotifyAuthorizationStatus();

    if (!authStatus.linked) {
      return {
        backend: "connected",
        spotify: "not-linked",
        userName: me.user.name,
        userEmail: me.user.email,
        spotifyDisplayName: "not linked",
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

    const profile = await client.getSpotifyProfile();
    const playerSnapshot = await refreshPlayerSnapshot(
      client,
      {
      ...createInitialHomeSnapshot(),
      backend: "connected",
      spotify: "linked",
      userName: me.user.name,
      userEmail: me.user.email,
      spotifyDisplayName: profile.displayName
      },
      { includeQueue: true }
    );

    if (playerSnapshot.failureReason === "unauthorized") {
      return playerSnapshot;
    }

    let recent: HomeSnapshot["recent"] = [];
    let recentUnavailable = false;

    try {
      recent = (await client.getSpotifyRecentlyPlayed()).items;
    } catch (error) {
      const apiError = error as ApiClientError;
      if (apiError?.name === "ApiClientError" && apiError.status === 403) {
        recentUnavailable = true;
      } else {
        throw error;
      }
    }

    return {
      backend: "connected",
      spotify: "linked",
      userName: me.user.name,
      userEmail: me.user.email,
      spotifyDisplayName: profile.displayName,
      deviceId: playerSnapshot.deviceId,
      deviceName: playerSnapshot.deviceName,
      deviceType: playerSnapshot.deviceType,
      deviceStatus: playerSnapshot.deviceStatus,
      supportsVolume: playerSnapshot.supportsVolume,
      volumePercent: playerSnapshot.volumePercent,
      playbackState: playerSnapshot.playbackState,
      shuffleEnabled: playerSnapshot.shuffleEnabled,
      repeatMode: playerSnapshot.repeatMode,
      trackName: playerSnapshot.trackName,
      artistName: playerSnapshot.artistName,
      albumName: playerSnapshot.albumName,
      progressMs: playerSnapshot.progressMs,
      durationMs: playerSnapshot.durationMs,
      queueStatus: playerSnapshot.queueStatus,
      queue: playerSnapshot.queue,
      recentUnavailable,
      recent
    };
  } catch (error) {
    const apiError = error as ApiClientError;
    return {
      ...createInitialHomeSnapshot(),
      userName: "unknown",
      spotifyDisplayName: "unknown",
      error: toMessage(error),
      failureReason: apiError?.name === "ApiClientError" && apiError.status === 401 ? "unauthorized" : undefined
    };
  }
}
