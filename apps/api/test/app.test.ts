import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { AppEnv } from "../src/config/env";
import { createLogger } from "../src/plugins/logger";

function baseEnv(nodeEnv: AppEnv["NODE_ENV"] = "test"): AppEnv {
  return {
    API_VERSION: "v1",
    APP_NAME: "clipify-api",
    BETTER_AUTH_SECRET: "super-secret-value-123",
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "https://example.com/db",
    HOST: "127.0.0.1",
    LATEST_CLI_VERSION: "0.1.0",
    LOG_LEVEL: "error",
    MIN_CLI_VERSION: "0.1.0",
    NODE_ENV: nodeEnv,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
    OTEL_EXPORTER_OTLP_HEADERS: "",
    OTEL_SERVICE_NAME: "clipify-api",
    PORT: 3000
  };
}

function createAuthMock(user: { id: string; email: string; name: string } | null) {
  return {
    handler() {
      return new Response("auth", { status: 200 });
    },
    api: {
      async getSession() {
        if (!user) {
          return null;
        }

        return { user };
      }
    }
  };
}

function createSpotifyMock() {
  return {
    isConfigured() {
      return true;
    },
    startAuthorization() {
      return {
        authorizeUrl: "https://accounts.spotify.com/authorize?state=abc",
        state: "abc"
      };
    },
    async completeAuthorization(userId: string) {
      return {
        linked: true,
        userId
      };
    },
    async completeAuthorizationFromCallback() {
      return {
        linked: true,
        userId: "u_123"
      };
    },
    async getAuthorizationStatus() {
      return {
        linked: true,
        relinkRequired: false
      };
    },
    async getCurrentlyPlaying() {
      return {
        playbackState: "playing",
        isPlaying: true,
        trackName: "Dreams",
        artistName: "Fleetwood Mac",
        albumName: "Rumours",
        albumImageUrl: "https://i.scdn.co/image/rumours",
        deviceId: "device-1",
        deviceName: "MacBook Pro",
        deviceType: "Computer",
        deviceStatus: "active",
        supportsVolume: true,
        volumePercent: 60,
        shuffleEnabled: false,
        repeatMode: "off",
        progressMs: 120000,
        durationMs: 257000
      };
    },
    async getDevices() {
      return {
        items: [
          {
            id: "device-1",
            name: "MacBook Pro",
            type: "Computer",
            isActive: true,
            isRestricted: false,
            supportsVolume: true,
            volumePercent: 60
          }
        ]
      };
    },
    async getQueue() {
      return {
        items: [
          {
            trackName: "Go Your Own Way",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            type: "track" as const
          }
        ]
      };
    },
    async getRecentlyPlayed() {
      return {
        items: [
          {
            id: "track-1",
            trackName: "Dreams",
            artistName: "Fleetwood Mac",
            albumName: "Rumours",
            uri: "spotify:track:1",
            durationMs: 257000,
            playedAt: "2026-04-08T10:00:00.000Z"
          }
        ]
      };
    },
    async getFeaturedPlaylists() {
      return {
        items: [
          {
            id: "playlist-1",
            name: "Focus Flow",
            description: "Deep work picks",
            imageUrl: "",
            ownerName: "Spotify",
            trackCount: 20,
            uri: "spotify:playlist:1"
          }
        ]
      };
    },
    async getPlaylists() {
      return {
        items: [
          {
            id: "playlist-2",
            name: "Daily Mix",
            description: "",
            imageUrl: "",
            ownerName: "Allar",
            trackCount: 12,
            uri: "spotify:playlist:2"
          }
        ]
      };
    },
    async getSavedTracks() {
      return {
        items: [
          {
            id: "track-2",
            trackName: "Duvet",
            artistName: "boa",
            albumName: "Twilight",
            uri: "spotify:track:2",
            durationMs: 201000
          }
        ]
      };
    },
    async getPlaylist() {
      return {
        id: "playlist-2",
        name: "Daily Mix",
        description: "",
        imageUrl: "",
        ownerName: "Allar",
        trackCount: 12,
        uri: "spotify:playlist:2",
        tracks: []
      };
    },
    async search() {
      return {
        tracks: [],
        playlists: [],
        albums: [],
        artists: []
      };
    },
    async play() {
      return { ok: true, action: "play" as const };
    },
    async pause() {
      return { ok: true, action: "pause" as const };
    },
    async next() {
      return { ok: true, action: "next" as const };
    },
    async previous() {
      return { ok: true, action: "previous" as const };
    },
    async playTrack() {
      return { ok: true, action: "play-track" as const };
    },
    async playContext() {
      return { ok: true, action: "play-context" as const };
    },
    async transferPlayback() {
      return { ok: true, action: "transfer" as const };
    },
    async setShuffle() {
      return { ok: true, action: "shuffle" as const };
    },
    async setRepeatMode() {
      return { ok: true, action: "repeat" as const };
    },
    async setVolume() {
      return { ok: true, action: "volume" as const };
    },
    async getProfile() {
      return {
        id: "spotify-user-1",
        displayName: "Allar",
        email: "allar@spotify.test",
        profileUrl: "https://open.spotify.com/user/allar",
        imageUrl: "https://i.scdn.co/image/avatar-1"
      };
    }
  };
}

describe("app routes", () => {
  test("returns public hard-coded payload", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/public/example"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { id: string; title: string; category: string };
    expect(body.id).toBe("example-1");
    expect(body.title).toBe("Public Example");
    expect(body.category).toBe("demo");
  });

  test("returns health payload", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { name: string; status: string };
    expect(body.name).toBe("clipify-api");
    expect(body.status).toBe("ok");
    expect(response.headers.get("x-request-id")).toBeString();
  });

  test("returns ready when dependency check succeeds", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/ready"));
    expect(response.status).toBe(200);
  });

  test("returns 503 when dependency check fails", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => false
    });

    const response = await app.handle(new Request("http://localhost/ready"));
    expect(response.status).toBe(503);
  });

  test("blocks protected route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(401);
  });

  test("returns protected profile with session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/me"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe("u_123");
  });

  test("keeps openapi json route available in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi/json"));
    expect(response.status).toBe(200);
  });

  test("blocks openapi ui in production", async () => {
    const env = baseEnv("production");

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/openapi"));
    expect(response.status).toBe(404);
  });

  test("returns public api compatibility metadata", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/public/meta/version"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { apiVersion: string; minCliVersion: string };
    expect(body.apiVersion).toBe("v1");
    expect(body.minCliVersion).toBe("0.1.0");
  });

  test("blocks spotify route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/auth/start"));
    expect(response.status).toBe(401);
  });

  test("returns spotify currently-playing when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/currently-playing"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { trackName: string; deviceName: string };
    expect(body.trackName).toBe("Dreams");
    expect(body.deviceName).toBe("MacBook Pro");
  });

  test("returns spotify devices when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/devices"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { items: Array<{ name: string; isActive: boolean }> };
    expect(body.items[0]?.name).toBe("MacBook Pro");
    expect(body.items[0]?.isActive).toBeTrue();
  });

  test("returns spotify recently played when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/recently-played"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { items: Array<{ trackName: string }> };
    expect(body.items[0]?.trackName).toBe("Dreams");
  });

  test("returns spotify queue when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/queue"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { items: Array<{ trackName: string }> };
    expect(body.items[0]?.trackName).toBe("Go Your Own Way");
  });

  test("runs spotify play action when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/play", { method: "POST" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { action: string };
    expect(body.action).toBe("play");
  });

  test("runs spotify player mode actions when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const shuffle = await app.handle(new Request("http://localhost/v1/spotify/me/player/shuffle?state=true", { method: "PUT" }));
    const repeat = await app.handle(new Request("http://localhost/v1/spotify/me/player/repeat?state=context", { method: "PUT" }));
    const volume = await app.handle(new Request("http://localhost/v1/spotify/me/player/volume?volumePercent=70", { method: "PUT" }));

    expect(shuffle.status).toBe(200);
    expect(repeat.status).toBe(200);
    expect(volume.status).toBe(200);
    expect(((await shuffle.json()) as { action: string }).action).toBe("shuffle");
    expect(((await repeat.json()) as { action: string }).action).toBe("repeat");
    expect(((await volume.json()) as { action: string }).action).toBe("volume");
  });

  test("runs spotify transfer action when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me/player/transfer?deviceId=device-1", { method: "PUT" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { action: string };
    expect(body.action).toBe("transfer");
  });

  test("returns spotify profile when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/me"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { displayName: string };
    expect(body.displayName).toBe("Allar");
  });

  test("allows spotify public callback route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/v1/spotify/auth/callback/public?code=code-1&state=state-1")
    );
    expect(response.status).toBe(200);
  });

  test("blocks spotify auth status route without session", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock(null) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/auth/status"));
    expect(response.status).toBe(401);
  });

  test("returns spotify auth status shape when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/spotify/auth/status"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { linked: boolean; relinkRequired: boolean };
    expect(body.linked).toBeTrue();
    expect(body.relinkRequired).toBeFalse();
  });

  test("returns cli bootstrap payload when session is present", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(new Request("http://localhost/v1/cli/bootstrap"));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      home: { spotify: string; userName: string; queueStatus: string };
      browse: { playlists: unknown[]; likedTracks: unknown[] };
    };
    expect(body.home.spotify).toBe("linked");
    expect(body.home.userName).toBe("Allar");
    expect(body.home.queueStatus).toBe("ready");
    expect(body.browse.playlists.length).toBeGreaterThan(0);
    expect(body.browse.likedTracks.length).toBeGreaterThan(0);
  });

  test("runs cli player action endpoint", async () => {
    const env = baseEnv();

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: createAuthMock({
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }) as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/v1/cli/player/action", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "play-context",
          contextUri: "spotify:playlist:2"
        })
      })
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as { action: string };
    expect(body.action).toBe("play-context");
  });

  test("forwards auth post body to auth handler", async () => {
    const env = baseEnv();
    let receivedEmail = "";

    const auth = {
      handler: async (request: Request) => {
        const body = (await request.json()) as { email?: string };
        receivedEmail = body.email ?? "";
        return Response.json({ ok: true });
      },
      api: {
        async getSession() {
          return null;
        }
      }
    };

    const app = createApp({
      env,
      logger: createLogger(env),
      auth: auth as never,
      spotify: createSpotifyMock() as never,
      checkReadiness: async () => true
    });

    const response = await app.handle(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: "allar@example.com",
          password: "secret"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(receivedEmail).toBe("allar@example.com");
  });
});
