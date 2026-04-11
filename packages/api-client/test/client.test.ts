import { describe, expect, test } from "bun:test";
import { ApiClientError, createApiClient } from "../src/client";

describe("api client", () => {
  test("returns parsed version metadata", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            appName: "clipify-api",
            apiVersion: "v1",
            minCliVersion: "0.1.0",
            latestCliVersion: "0.1.0"
          })
        )
    });

    const payload = await client.getVersion();
    expect(payload.apiVersion).toBe("v1");
  });

  test("throws on non-2xx response", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => new Response("nope", { status: 503 })
    });

    expect(client.getVersion()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("sends cookie header for protected spotify routes", async () => {
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (_url, init) => {
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          authorizeUrl: "https://accounts.spotify.com/authorize?state=abc",
          state: "abc"
        });
      }
    });

    const payload = await client.startSpotifyAuthorization();
    expect(payload.state).toBe("abc");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("returns current user profile for protected me route", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async () =>
        Response.json({
          user: {
            id: "user-1",
            email: "allar@example.com",
            name: "Allar"
          }
        })
    });

    const payload = await client.getMe();
    expect(payload.user.id).toBe("user-1");
  });

  test("signs in with email/password and returns persisted session cookie value", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            redirect: false,
            token: "token-1",
            user: { id: "user-1", email: "allar@example.com", name: "Allar" }
          }),
          {
            status: 200,
            headers: {
              "set-cookie": "better-auth.session_token=signed-token-123; Path=/; HttpOnly"
            }
          }
        )
    });

    const payload = await client.signInWithEmailPassword({
      email: "allar@example.com",
      password: "super-secret"
    });

    expect(payload.sessionCookie).toBe("better-auth.session_token=signed-token-123");
  });

  test("signs up with email/password and returns persisted session cookie value", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            user: { id: "user-1", email: "allar@example.com", name: "Allar" }
          }),
          {
            status: 200,
            headers: {
              "set-cookie": "better-auth.session_token=signed-up-token-123; Path=/; HttpOnly"
            }
          }
        )
    });

    const payload = await client.signUpWithEmailPassword({
      name: "Allar",
      email: "allar@example.com",
      password: "super-secret"
    });

    expect(payload.sessionCookie).toBe("better-auth.session_token=signed-up-token-123");
  });

  test("signs out with the persisted session cookie", async () => {
    let requestedUrl = "";
    let method = "";
    let cookieHeader = "";
    let originHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        method = init?.method ?? "GET";
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        originHeader = new Headers(init?.headers).get("origin") ?? "";
        return Response.json({ success: true });
      }
    });

    await client.signOut();

    expect(requestedUrl).toContain("/api/auth/sign-out");
    expect(method).toBe("POST");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
    expect(originHeader).toBe("https://example.com");
  });

  test("builds callback query parameters", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          linked: true,
          userId: "user-1"
        });
      }
    });

    const payload = await client.completeSpotifyAuthorization({
      code: "code-1",
      state: "state-1"
    });

    expect(payload.linked).toBeTrue();
    expect(requestedUrl).toContain("/v1/spotify/auth/callback");
    expect(requestedUrl).toContain("code=code-1");
    expect(requestedUrl).toContain("state=state-1");
  });

  test("returns spotify authorization status for authenticated user", async () => {
    let requestedUrl = "";
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          linked: true,
          relinkRequired: false
        });
      }
    });

    const payload = await client.getSpotifyAuthorizationStatus();

    expect(payload.linked).toBeTrue();
    expect(payload.relinkRequired).toBeFalse();
    expect(requestedUrl).toContain("/v1/spotify/auth/status");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("returns spotify profile for authenticated user", async () => {
    let requestedUrl = "";
    let cookieHeader = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        cookieHeader = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({
          id: "spotify-user-1",
          displayName: "Allar",
          email: "allar@spotify.test",
          profileUrl: "https://open.spotify.com/user/allar",
          imageUrl: "https://i.scdn.co/image/avatar-1"
        });
      }
    });

    const payload = await client.getSpotifyProfile();

    expect(payload.id).toBe("spotify-user-1");
    expect(payload.displayName).toBe("Allar");
    expect(requestedUrl).toContain("/v1/spotify/me");
    expect(cookieHeader).toBe("better-auth.session_token=abc123");
  });

  test("returns rich currently playing payload for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
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
        });
      }
    });

    const payload = await client.getSpotifyCurrentlyPlaying();

    expect(payload.playbackState).toBe("playing");
    expect(payload.deviceName).toBe("MacBook Pro");
    expect(requestedUrl).toContain("/v1/spotify/me/player/currently-playing");
  });

  test("returns spotify devices for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
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
        });
      }
    });

    const payload = await client.getSpotifyDevices();

    expect(payload.items[0]?.name).toBe("MacBook Pro");
    expect(payload.items[0]?.isActive).toBeTrue();
    expect(requestedUrl).toContain("/v1/spotify/me/player/devices");
  });

  test("returns recently played items for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
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
        });
      }
    });

    const payload = await client.getSpotifyRecentlyPlayed();

    expect(payload.items[0]?.trackName).toBe("Dreams");
    expect(requestedUrl).toContain("/v1/spotify/me/player/recently-played");
  });

  test("returns browse and search payloads for authenticated user", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        const value = String(url);

        if (value.includes("/browse/featured-playlists")) {
          return Response.json({
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
          });
        }

        if (value.includes("/me/playlists")) {
          return Response.json({
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
          });
        }

        if (value.includes("/me/tracks")) {
          return Response.json({
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
          });
        }

        if (value.includes("/search")) {
          return Response.json({
            tracks: [],
            playlists: [],
            albums: [
              {
                id: "album-1",
                name: "Rumours",
                artistName: "Fleetwood Mac",
                imageUrl: "",
                uri: "spotify:album:1"
              }
            ],
            artists: []
          });
        }

        return Response.json({
          id: "playlist-2",
          name: "Daily Mix",
          description: "",
          imageUrl: "",
          ownerName: "Allar",
          trackCount: 12,
          uri: "spotify:playlist:2",
          tracks: []
        });
      }
    });

    const [featured, playlists, savedTracks, search, playlist] = await Promise.all([
      client.getSpotifyFeaturedPlaylists(),
      client.getSpotifyPlaylists(),
      client.getSpotifySavedTracks(),
      client.searchSpotify("rumours"),
      client.getSpotifyPlaylist("playlist-2")
    ]);

    expect(featured.items[0]?.name).toBe("Focus Flow");
    expect(playlists.items[0]?.name).toBe("Daily Mix");
    expect(savedTracks.items[0]?.trackName).toBe("Duvet");
    expect(search.albums[0]?.name).toBe("Rumours");
    expect(playlist.name).toBe("Daily Mix");
  });

  test("returns queue items for authenticated user", async () => {
    let requestedUrl = "";
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({
          items: [
            {
              trackName: "Go Your Own Way",
              artistName: "Fleetwood Mac",
              albumName: "Rumours",
              type: "track"
            }
          ]
        });
      }
    });

    const payload = await client.getSpotifyQueue();

    expect(payload.items[0]?.trackName).toBe("Go Your Own Way");
    expect(requestedUrl).toContain("/v1/spotify/me/player/queue");
  });

  test("posts spotify playback and mode actions for authenticated user", async () => {
    const calls: Array<{ url: string; method: string; cookie: string }> = [];
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method ?? "GET",
          cookie: new Headers(init?.headers).get("cookie") ?? ""
        });

        if (String(url).includes("/play-track")) {
          return Response.json({ ok: true, action: "play-track" });
        }

        if (String(url).includes("/play-context")) {
          return Response.json({ ok: true, action: "play-context" });
        }

        if (String(url).endsWith("/play")) {
          return Response.json({ ok: true, action: "play" });
        }

        if (String(url).endsWith("/pause")) {
          return Response.json({ ok: true, action: "pause" });
        }

        if (String(url).endsWith("/next")) {
          return Response.json({ ok: true, action: "next" });
        }

        if (String(url).includes("/transfer")) {
          return Response.json({ ok: true, action: "transfer" });
        }

        if (String(url).includes("/shuffle")) {
          return Response.json({ ok: true, action: "shuffle" });
        }

        if (String(url).includes("/repeat")) {
          return Response.json({ ok: true, action: "repeat" });
        }

        if (String(url).includes("/volume")) {
          return Response.json({ ok: true, action: "volume" });
        }

        return Response.json({ ok: true, action: "previous" });
      }
    });

    await client.playSpotify();
    await client.pauseSpotify();
    await client.nextSpotify();
    await client.previousSpotify();
    await client.playSpotifyTrack("spotify:track:1");
    await client.playSpotifyContext("spotify:album:1");
    await client.transferSpotifyPlayback("device-2");
    await client.setSpotifyShuffle(true);
    await client.setSpotifyRepeatMode("context");
    await client.setSpotifyVolume(70);

    expect(calls).toHaveLength(10);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.cookie).toBe("better-auth.session_token=abc123");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/play");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/pause");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/next");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/previous");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/play-track?uri=spotify%3Atrack%3A1");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/play-context?contextUri=spotify%3Aalbum%3A1");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/transfer?deviceId=device-2");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/shuffle?state=true");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/repeat?state=context");
    expect(calls.map((call) => call.url)).toContain("https://example.com/v1/spotify/me/player/volume?volumePercent=70");
  });

  test("throws when protected route is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({})
    });

    expect(client.getSpotifyCurrentlyPlaying()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("throws when sign-out is called without session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () => Response.json({ success: true })
    });

    await expect(client.signOut()).rejects.toBeInstanceOf(ApiClientError);
  });

  test("throws when sign-in response does not include session cookie", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      fetchImpl: async () =>
        Response.json({
          redirect: false,
          token: "token-1"
        })
    });

    await expect(
      client.signInWithEmailPassword({
        email: "allar@example.com",
        password: "super-secret"
      })
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  test("throws on sign-out failure response", async () => {
    const client = createApiClient({
      baseUrl: "https://example.com",
      sessionCookie: "better-auth.session_token=abc123",
      fetchImpl: async () => new Response("nope", { status: 500 })
    });

    await expect(client.signOut()).rejects.toBeInstanceOf(ApiClientError);
  });
});
