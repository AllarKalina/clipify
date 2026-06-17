import type {
  SpotifyDeviceSummary,
  SpotifyDevicesResponse,
  SpotifyPlayerAction,
  SpotifyPlayerActionResponse,
  SpotifyQueueResponse,
  SpotifyRecentlyPlayedResponse,
  SpotifyRepeatMode,
  SpotifyCurrentlyPlayingResponse
} from "../contracts";
import {
  clampVolume,
  parsePlayerFailure,
  readSpotifyError,
  summarizeDevice,
  toDeviceStatus,
  toRepeatMode,
  type SpotifyServiceContext
} from "./shared";

function pickPrimaryDevice(devices: SpotifyDeviceSummary[]): SpotifyDeviceSummary | null {
  return devices.find((device) => device.isActive) ?? devices.find((device) => !device.isRestricted) ?? devices[0] ?? null;
}

async function fetchDevices(context: SpotifyServiceContext, userId: string): Promise<SpotifyDeviceSummary[]> {
  const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/devices");

  if (!response.ok) {
    const text = await response.text();
    throw new Response(`Spotify devices request failed (${response.status}): ${text || "empty response"}`, {
      status: response.status === 401 ? 401 : 502
    });
  }

  const payload = (await response.json()) as {
    devices?: Array<{
      id?: string;
      is_active?: boolean;
      is_restricted?: boolean;
      name?: string;
      supports_volume?: boolean;
      type?: string;
      volume_percent?: number | null;
    }>;
  };

  return (payload.devices ?? []).map((device) => summarizeDevice(device));
}

async function runPlayerAction(context: SpotifyServiceContext, userId: string, action: SpotifyPlayerAction): Promise<SpotifyPlayerActionResponse> {
  context.requireConfigured();

  const path =
    action === "play"
      ? "play"
      : action === "pause"
        ? "pause"
        : action === "next"
          ? "next"
          : "previous";
  const method = action === "play" || action === "pause" ? "PUT" : "POST";
  const { response } = await context.fetchSpotifyWithRetry(userId, `https://api.spotify.com/v1/me/player/${path}`, {
    method
  });

  if (!response.ok) {
    const failure = parsePlayerFailure(await readSpotifyError(response));
    throw new Response(failure.message, { status: failure.status });
  }

  return {
    ok: true,
    action
  };
}

async function runPlayerSettingAction(
  context: SpotifyServiceContext,
  userId: string,
  action: "shuffle" | "repeat" | "volume",
  query: Record<string, string>
): Promise<SpotifyPlayerActionResponse> {
  context.requireConfigured();

  const url = new URL(`https://api.spotify.com/v1/me/player/${action}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const { response } = await context.fetchSpotifyWithRetry(userId, url.toString(), {
    method: "PUT"
  });

  if (!response.ok) {
    const failure = parsePlayerFailure(await readSpotifyError(response));
    throw new Response(failure.message, { status: failure.status });
  }

  return {
    ok: true,
    action
  };
}

async function runPlayPayloadAction(
  context: SpotifyServiceContext,
  userId: string,
  action: "play-track" | "play-context",
  payload: Record<string, unknown>
): Promise<SpotifyPlayerActionResponse> {
  context.requireConfigured();

  const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const failure = parsePlayerFailure(await readSpotifyError(response));
    throw new Response(failure.message, { status: failure.status });
  }

  return {
    ok: true,
    action
  };
}

export type SpotifyPlayerService = {
  getCurrentlyPlaying: (userId: string) => Promise<SpotifyCurrentlyPlayingResponse>;
  getDevices: (userId: string) => Promise<SpotifyDevicesResponse>;
  getQueue: (userId: string) => Promise<SpotifyQueueResponse>;
  getRecentlyPlayed: (userId: string) => Promise<SpotifyRecentlyPlayedResponse>;
  play: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  pause: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  next: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  previous: (userId: string) => Promise<SpotifyPlayerActionResponse>;
  playTrack: (userId: string, uri: string) => Promise<SpotifyPlayerActionResponse>;
  playContext: (userId: string, contextUri: string) => Promise<SpotifyPlayerActionResponse>;
  transferPlayback: (userId: string, deviceId: string) => Promise<SpotifyPlayerActionResponse>;
  setShuffle: (userId: string, enabled: boolean) => Promise<SpotifyPlayerActionResponse>;
  setRepeatMode: (userId: string, mode: SpotifyRepeatMode) => Promise<SpotifyPlayerActionResponse>;
  setVolume: (userId: string, volumePercent: number) => Promise<SpotifyPlayerActionResponse>;
};

export function createSpotifyPlayerService(context: SpotifyServiceContext): SpotifyPlayerService {
  return {
    async getCurrentlyPlaying(userId) {
      context.requireConfigured();

      const [{ response }, devices] = await Promise.all([
        context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player"),
        fetchDevices(context, userId)
      ]);

      const primaryDevice = pickPrimaryDevice(devices);

      const baseDevice = {
        deviceId: primaryDevice?.id ?? "",
        deviceName: primaryDevice?.name ?? "",
        deviceType: primaryDevice?.type ?? "",
        deviceStatus: toDeviceStatus(primaryDevice),
        supportsVolume: primaryDevice?.supportsVolume ?? false,
        volumePercent: primaryDevice?.volumePercent ?? 0,
        shuffleEnabled: false,
        repeatMode: "off" as const
      };

      if (response.status === 204) {
        return {
          playbackState: "idle",
          isPlaying: false,
          trackName: "",
          artistName: "",
          albumName: "",
          albumImageUrl: "",
          contextUri: "",
          ...baseDevice,
          progressMs: 0,
          durationMs: 0
        };
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify currently-playing request failed (${response.status}): ${text || "empty response"}`, {
          status: 502
        });
      }

      const payload = (await response.json()) as {
        is_playing?: boolean;
        shuffle_state?: boolean;
        repeat_state?: string;
        progress_ms?: number;
        device?: {
          id?: string;
          is_active?: boolean;
          is_restricted?: boolean;
          name?: string;
          supports_volume?: boolean;
          type?: string;
          volume_percent?: number | null;
        };
        item?: {
          name?: string;
          duration_ms?: number;
          artists?: { name?: string }[];
          album?: { name?: string; images?: { url?: string }[] };
        };
        context?: {
          uri?: string | null;
        } | null;
      };

      const currentDevice = payload.device ? summarizeDevice(payload.device) : null;
      const resolvedDevice = currentDevice
        ? {
            deviceId: currentDevice.id || baseDevice.deviceId,
            deviceName: currentDevice.name || baseDevice.deviceName,
            deviceType: currentDevice.type || baseDevice.deviceType,
            deviceStatus: toDeviceStatus(currentDevice),
            supportsVolume: currentDevice.supportsVolume,
            volumePercent: currentDevice.volumePercent
          }
        : baseDevice;

      return {
        playbackState: payload.item?.name ? (payload.is_playing ? "playing" : "paused") : "idle",
        isPlaying: Boolean(payload.is_playing),
        trackName: payload.item?.name ?? "",
        artistName: payload.item?.artists?.[0]?.name ?? "",
        albumName: payload.item?.album?.name ?? "",
        albumImageUrl: payload.item?.album?.images?.[0]?.url ?? "",
        contextUri: payload.context?.uri ?? "",
        deviceId: resolvedDevice.deviceId,
        deviceName: resolvedDevice.deviceName,
        deviceType: resolvedDevice.deviceType,
        deviceStatus: resolvedDevice.deviceStatus,
        supportsVolume: resolvedDevice.supportsVolume,
        volumePercent: resolvedDevice.volumePercent,
        shuffleEnabled: Boolean(payload.shuffle_state),
        repeatMode: toRepeatMode(payload.repeat_state),
        progressMs: payload.progress_ms ?? 0,
        durationMs: payload.item?.duration_ms ?? 0
      };
    },

    async getDevices(userId) {
      context.requireConfigured();
      return {
        items: await fetchDevices(context, userId)
      };
    },

    async getQueue(userId) {
      context.requireConfigured();

      const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/queue");

      if (response.status === 204) {
        return { items: [] };
      }

      if (!response.ok) {
        const failure = parsePlayerFailure(await readSpotifyError(response));
        throw new Response(failure.message, { status: failure.status });
      }

      const payload = (await response.json()) as {
        queue?: Array<{
          type?: string;
          name?: string;
          artists?: { name?: string }[];
          show?: { publisher?: string };
          album?: { name?: string };
        }>;
      };

      return {
        items: (payload.queue ?? []).slice(0, 5).map((item) => ({
          trackName: item.name ?? "",
          artistName: item.artists?.[0]?.name ?? item.show?.publisher ?? "",
          albumName: item.album?.name ?? "",
          type: item.type === "track" || item.type === "episode" ? item.type : "unknown"
        }))
      };
    },

    async getRecentlyPlayed(userId) {
      context.requireConfigured();

      const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player/recently-played?limit=5");

      if (!response.ok) {
        const text = await response.text();
        throw new Response(`Spotify recently-played request failed (${response.status}): ${text || "empty response"}`, {
          status: response.status
        });
      }

      const payload = (await response.json()) as {
        items?: Array<{
          played_at?: string;
          track?: {
            id?: string;
            name?: string;
            artists?: { name?: string }[];
            album?: { name?: string };
            uri?: string;
            duration_ms?: number;
          };
        }>;
      };

      return {
        items: (payload.items ?? []).map((item) => ({
          id: item.track?.id ?? "",
          trackName: item.track?.name ?? "",
          artistName: item.track?.artists?.[0]?.name ?? "",
          albumName: item.track?.album?.name ?? "",
          uri: item.track?.uri ?? "",
          durationMs: item.track?.duration_ms ?? 0,
          playedAt: item.played_at ?? ""
        }))
      };
    },

    play(userId) {
      return runPlayerAction(context, userId, "play");
    },
    pause(userId) {
      return runPlayerAction(context, userId, "pause");
    },
    next(userId) {
      return runPlayerAction(context, userId, "next");
    },
    previous(userId) {
      return runPlayerAction(context, userId, "previous");
    },
    playTrack(userId, uri) {
      return runPlayPayloadAction(context, userId, "play-track", {
        uris: [uri]
      });
    },
    playContext(userId, contextUri) {
      return runPlayPayloadAction(context, userId, "play-context", {
        context_uri: contextUri
      });
    },
    async transferPlayback(userId, deviceId) {
      context.requireConfigured();

      if (!deviceId) {
        throw new Response("Device id is required", { status: 400 });
      }

      const { response } = await context.fetchSpotifyWithRetry(userId, "https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      });

      if (!response.ok) {
        const failure = parsePlayerFailure(await readSpotifyError(response));
        throw new Response(failure.message, { status: failure.status });
      }

      return {
        ok: true,
        action: "transfer"
      };
    },
    setShuffle(userId, enabled) {
      return runPlayerSettingAction(context, userId, "shuffle", {
        state: enabled ? "true" : "false"
      });
    },
    setRepeatMode(userId, mode) {
      return runPlayerSettingAction(context, userId, "repeat", {
        state: mode
      });
    },
    setVolume(userId, volumePercent) {
      return runPlayerSettingAction(context, userId, "volume", {
        volume_percent: String(clampVolume(volumePercent))
      });
    }
  };
}
