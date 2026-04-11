import type {
  CliBootstrapResponse,
  CliDevicesResponse,
  CliLibraryViewResponse,
  CliPlayerActionRequest,
  CliPlayerActionResponse,
  CliPlayerSnapshotResponse,
  CliSearchResponse
} from "@clipify/contracts/cli";
import type { AuthSession } from "../auth/session";
import type { SpotifyService } from "../spotify/service";

function createDefaultHome(session: AuthSession["user"], spotify: CliBootstrapResponse["home"]["spotify"]): CliBootstrapResponse["home"] {
  const linked = spotify === "linked";
  const relinkRequired = spotify === "relink-required";

  return {
    spotify,
    userName: session.name,
    userEmail: session.email,
    spotifyDisplayName: spotify === "not-linked" ? "not linked" : relinkRequired ? "relink required" : "",
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
    recent: [],
    linked,
    relinkRequired,
    profile: null
  };
}

export function createCliBffService(spotify: SpotifyService) {
  async function loadPlayerSnapshot(session: AuthSession["user"]): Promise<CliPlayerSnapshotResponse> {
      const auth = await spotify.getAuthorizationStatus(session.id);

      if (!auth.linked) {
        return {
          home: createDefaultHome(session, "not-linked"),
          warning: ""
        };
      }

      if (auth.relinkRequired) {
        return {
          home: createDefaultHome(session, "relink-required"),
          warning: ""
        };
      }

      const warnings: string[] = [];
      const [profileResult, currentlyPlayingResult] = await Promise.allSettled([
        spotify.getProfile(session.id),
        spotify.getCurrentlyPlaying(session.id)
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      if (profileResult.status === "rejected") {
        warnings.push("profile unavailable");
      }

      let currentlyPlaying =
        currentlyPlayingResult.status === "fulfilled"
          ? currentlyPlayingResult.value
          : {
              playbackState: "idle" as const,
              isPlaying: false,
              trackName: "",
              artistName: "",
              albumName: "",
              albumImageUrl: "",
              deviceId: "",
              deviceName: "",
              deviceType: "",
              deviceStatus: "none" as const,
              supportsVolume: false,
              volumePercent: 0,
              shuffleEnabled: false,
              repeatMode: "off" as const,
              progressMs: 0,
              durationMs: 0
            };

      if (currentlyPlayingResult.status === "rejected") {
        warnings.push("player state unavailable");

        try {
          const devices = (await spotify.getDevices(session.id)).items;
          const primaryDevice = devices.find((device) => device.isActive) ?? devices.find((device) => !device.isRestricted) ?? devices[0];

          if (primaryDevice) {
            currentlyPlaying = {
              ...currentlyPlaying,
              deviceId: primaryDevice.id,
              deviceName: primaryDevice.name,
              deviceType: primaryDevice.type,
              deviceStatus: primaryDevice.isRestricted ? "restricted" : primaryDevice.isActive ? "active" : "available",
              supportsVolume: primaryDevice.supportsVolume,
              volumePercent: primaryDevice.volumePercent
            };
          }
        } catch {
          warnings.push("devices unavailable");
        }
      }

      let queue: CliBootstrapResponse["home"]["queue"] = [];
      const queueStatus = await (async () => {
        try {
          queue = (await spotify.getQueue(session.id)).items;
          return "ready" as const;
        } catch (error) {
          if (error instanceof Response) {
            if (error.status === 403) {
              return "relink-required" as const;
            }

            if (error.status === 409) {
              return "no-device" as const;
            }
          }

          warnings.push("queue unavailable");
          return "unavailable" as const;
        }
      })();

      let recent: CliBootstrapResponse["home"]["recent"] = [];
      let recentUnavailable = false;
      try {
        recent = (await spotify.getRecentlyPlayed(session.id)).items;
      } catch (error) {
        if (error instanceof Response && error.status === 403) {
          recentUnavailable = true;
        } else {
          recentUnavailable = true;
          warnings.push("recent playback unavailable");
        }
      }

      return {
        home: {
          spotify: "linked",
          userName: session.name,
          userEmail: session.email,
          spotifyDisplayName: profile?.displayName || session.name,
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
          queueStatus,
          queue,
          recentUnavailable,
          recent,
          linked: true,
          relinkRequired: false,
          profile
        },
        warning: warnings.join(" | ")
      };
  }

  return {
    async startAuthorization(userId: string) {
      return spotify.startAuthorization(userId);
    },

    async completeAuthorizationFromCallback(code: string, state: string) {
      return spotify.completeAuthorizationFromCallback(code, state);
    },

    async getAuthorizationStatus(userId: string) {
      return spotify.getAuthorizationStatus(userId);
    },

    async getPlayerSnapshot(session: AuthSession["user"]): Promise<CliPlayerSnapshotResponse> {
      return loadPlayerSnapshot(session);
    },

    async getBootstrap(session: AuthSession["user"]): Promise<CliBootstrapResponse> {
      const snapshot = await loadPlayerSnapshot(session);
      const warnings = snapshot.warning ? [snapshot.warning] : [];

      const [featuredResult, playlistsResult, likedResult] = await Promise.allSettled([
        spotify.getFeaturedPlaylists(session.id),
        spotify.getPlaylists(session.id),
        spotify.getSavedTracks(session.id)
      ]);

      const featuredPlaylists =
        featuredResult.status === "fulfilled"
          ? featuredResult.value.items
          : [];
      const playlists =
        playlistsResult.status === "fulfilled"
          ? playlistsResult.value.items
          : [];
      const likedTracks =
        likedResult.status === "fulfilled"
          ? likedResult.value.items
          : [];

      if (
        featuredResult.status === "rejected" &&
        !(featuredResult.reason instanceof Response && featuredResult.reason.status === 403)
      ) {
        warnings.push("featured picks unavailable");
      }

      if (playlistsResult.status === "rejected") {
        warnings.push("playlists unavailable");
      }

      if (likedResult.status === "rejected") {
        warnings.push("liked songs unavailable");
      }

      return {
        home: snapshot.home,
        browse: {
          featuredPlaylists,
          playlists,
          likedTracks
        },
        warning: warnings.join(" | ")
      };
    },

    async getLibraryView(userId: string, libraryId: string): Promise<CliLibraryViewResponse> {
      if (libraryId === "liked") {
        const liked = await spotify.getSavedTracks(userId);
        return {
          section: {
            id: "liked-tracks",
            title: "Liked songs",
            items: liked.items.map((track) => ({
              id: track.id || track.uri,
              title: track.trackName,
              subtitle: track.artistName,
              meta: track.albumName,
              action: { type: "play-track", uri: track.uri }
            }))
          }
        };
      }

      const playlist = await spotify.getPlaylist(userId, libraryId);
      return {
        section: {
          id: `playlist-${playlist.id}`,
          title: playlist.name,
          items: playlist.tracks.map((track) => ({
            id: track.id || track.uri,
            title: track.trackName,
            subtitle: track.artistName,
            meta: track.albumName,
            action: { type: "play-track", uri: track.uri }
          }))
        }
      };
    },

    async search(userId: string, query: string): Promise<CliSearchResponse> {
      return spotify.search(userId, query);
    },

    async getDevices(userId: string): Promise<CliDevicesResponse> {
      return spotify.getDevices(userId);
    },

    async runPlayerAction(userId: string, request: CliPlayerActionRequest): Promise<CliPlayerActionResponse> {
      switch (request.action) {
        case "play":
          return spotify.play(userId);
        case "pause":
          return spotify.pause(userId);
        case "next":
          return spotify.next(userId);
        case "previous":
          return spotify.previous(userId);
        case "shuffle":
          return spotify.setShuffle(userId, request.enabled);
        case "repeat":
          return spotify.setRepeatMode(userId, request.mode);
        case "volume":
          return spotify.setVolume(userId, request.volumePercent);
        case "transfer":
          return spotify.transferPlayback(userId, request.deviceId);
        case "play-track":
          return spotify.playTrack(userId, request.uri);
        case "play-context":
          return spotify.playContext(userId, request.contextUri);
        default:
          throw new Response("Unsupported player action", { status: 400 });
      }
    }
  };
}
