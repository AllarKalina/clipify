import { z } from "zod";

export const versionSchema = z.object({
  appName: z.string(),
  apiVersion: z.string(),
  minCliVersion: z.string(),
  latestCliVersion: z.string()
});

export const meSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string()
  })
});

export const cliAuthStartSchema = z.object({
  authorizeUrl: z.string().url(),
  state: z.string()
});

export const cliAuthCallbackSchema = z.object({
  linked: z.boolean(),
  userId: z.string()
});

export const cliAuthStatusSchema = z.object({
  linked: z.boolean(),
  relinkRequired: z.boolean()
});

const spotifyDeviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isActive: z.boolean(),
  isRestricted: z.boolean(),
  supportsVolume: z.boolean(),
  volumePercent: z.number()
});

const spotifyTrackSummarySchema = z.object({
  id: z.string(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  uri: z.string(),
  durationMs: z.number()
});

const spotifyPlaylistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  ownerName: z.string(),
  isPinned: z.boolean().optional(),
  trackCount: z.number(),
  uri: z.string()
});

const spotifyAlbumSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  artistName: z.string(),
  imageUrl: z.string(),
  uri: z.string()
});

const spotifyArtistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  uri: z.string()
});

const spotifyProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  profileUrl: z.string(),
  imageUrl: z.string()
});

export const cliBootstrapSchema = z.object({
  home: z.object({
    spotify: z.enum(["linked", "not-linked", "relink-required"]),
    userName: z.string(),
    userEmail: z.string(),
    spotifyDisplayName: z.string(),
    deviceId: z.string(),
    deviceName: z.string(),
    deviceType: z.string(),
    deviceStatus: z.enum(["active", "available", "restricted", "none"]),
    supportsVolume: z.boolean(),
    volumePercent: z.number(),
    playbackState: z.enum(["playing", "paused", "idle"]),
    shuffleEnabled: z.boolean(),
    repeatMode: z.enum(["off", "track", "context"]),
    trackName: z.string(),
    artistName: z.string(),
    albumName: z.string(),
    progressMs: z.number(),
    durationMs: z.number(),
    queueStatus: z.enum(["ready", "no-device", "relink-required", "unavailable"]),
    queue: z.array(
      z.object({
        trackName: z.string(),
        artistName: z.string(),
        albumName: z.string(),
        type: z.enum(["track", "episode", "unknown"])
      })
    ),
    recentUnavailable: z.boolean(),
    recent: z.array(
      z.object({
        id: z.string(),
        trackName: z.string(),
        artistName: z.string(),
        albumName: z.string(),
        uri: z.string(),
        durationMs: z.number(),
        playedAt: z.string()
      })
    ),
    linked: z.boolean(),
    relinkRequired: z.boolean(),
    profile: spotifyProfileSchema.nullable()
  }),
  browse: z.object({
    featuredPlaylists: z.array(spotifyPlaylistSummarySchema),
    playlists: z.array(spotifyPlaylistSummarySchema),
    likedTracks: z.array(spotifyTrackSummarySchema)
  }),
  warning: z.string()
});

export const cliHomeViewSchema = z.object({
  sections: z.array(
    z.object({
      id: z.enum(["quick-launch", "picked"]),
      title: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          subtitle: z.string(),
          meta: z.string(),
          action: z.union([
            z.object({
              type: z.literal("play-context"),
              uri: z.string()
            }),
            z.object({
              type: z.literal("open-playlist"),
              playlistId: z.string()
            })
          ])
        })
      )
    })
  )
});

export const cliLibraryViewSchema = z.object({
  section: z
    .object({
      id: z.string(),
      title: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          subtitle: z.string(),
          meta: z.string().optional(),
          action: z.object({
            type: z.literal("play-track"),
            uri: z.string()
          })
        })
      )
    })
    .nullable()
});

export const cliSearchSchema = z.object({
  tracks: z.array(spotifyTrackSummarySchema),
  playlists: z.array(spotifyPlaylistSummarySchema),
  albums: z.array(spotifyAlbumSummarySchema),
  artists: z.array(spotifyArtistSummarySchema)
});

export const cliDevicesSchema = z.object({
  items: z.array(spotifyDeviceSummarySchema)
});

export const cliPlayerActionRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("play") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("previous") }),
  z.object({ action: z.literal("shuffle"), enabled: z.boolean() }),
  z.object({ action: z.literal("repeat"), mode: z.enum(["off", "track", "context"]) }),
  z.object({ action: z.literal("volume"), volumePercent: z.number() }),
  z.object({ action: z.literal("transfer"), deviceId: z.string() }),
  z.object({ action: z.literal("play-track"), uri: z.string() }),
  z.object({ action: z.literal("play-context"), contextUri: z.string() })
]);

export const cliPlayerActionSchema = z.object({
  ok: z.literal(true),
  action: z.enum(["play", "pause", "next", "previous", "shuffle", "repeat", "volume", "transfer", "play-track", "play-context"])
});
