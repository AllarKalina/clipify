import type { ApiClient, ApiClientError } from "@clipify/api-client";

export type HomeSnapshot = {
  backend: "connected" | "offline";
  spotify: "linked" | "not-linked" | "unknown";
  userName: string;
  userEmail: string;
  spotifyDisplayName: string;
  deviceName: string;
  deviceType: string;
  playbackState: "playing" | "paused" | "idle";
  trackName: string;
  artistName: string;
  albumName: string;
  progressMs: number;
  durationMs: number;
  recentUnavailable: boolean;
  recent: Array<{
    trackName: string;
    artistName: string;
    albumName: string;
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
    deviceName: "",
    deviceType: "",
    playbackState: "idle",
    trackName: "",
    artistName: "",
    albumName: "",
    progressMs: 0,
    durationMs: 0,
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
        deviceName: "",
        deviceType: "",
        playbackState: "idle",
        trackName: "",
        artistName: "",
        albumName: "",
        progressMs: 0,
        durationMs: 0,
        recentUnavailable: false,
        recent: []
      };
    }

    const profile = await client.getSpotifyProfile();
    const currentlyPlaying = await client.getSpotifyCurrentlyPlaying();
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
      deviceName: currentlyPlaying.deviceName,
      deviceType: currentlyPlaying.deviceType,
      playbackState: currentlyPlaying.playbackState,
      trackName: currentlyPlaying.trackName,
      artistName: currentlyPlaying.artistName,
      albumName: currentlyPlaying.albumName,
      progressMs: currentlyPlaying.progressMs,
      durationMs: currentlyPlaying.durationMs,
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
