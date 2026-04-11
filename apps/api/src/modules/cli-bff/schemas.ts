import { t } from "elysia";

export const cliPlaylistSummarySchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  imageUrl: t.String(),
  ownerName: t.String(),
  isPinned: t.Optional(t.Boolean()),
  trackCount: t.Number(),
  uri: t.String()
});

export const cliTrackSummarySchema = t.Object({
  id: t.String(),
  trackName: t.String(),
  artistName: t.String(),
  albumName: t.String(),
  uri: t.String(),
  durationMs: t.Number()
});

export const cliDeviceSummarySchema = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.String(),
  isActive: t.Boolean(),
  isRestricted: t.Boolean(),
  supportsVolume: t.Boolean(),
  volumePercent: t.Number()
});

export const cliPlayerProfileSchema = t.Object({
  id: t.String(),
  displayName: t.String(),
  email: t.String(),
  profileUrl: t.String(),
  imageUrl: t.String()
});

export const cliPlayerHomeSummarySchema = t.Object({
  spotify: t.Union([t.Literal("linked"), t.Literal("not-linked"), t.Literal("relink-required")]),
  userName: t.String(),
  userEmail: t.String(),
  spotifyDisplayName: t.String(),
  deviceId: t.String(),
  deviceName: t.String(),
  deviceType: t.String(),
  deviceStatus: t.Union([t.Literal("active"), t.Literal("available"), t.Literal("restricted"), t.Literal("none")]),
  supportsVolume: t.Boolean(),
  volumePercent: t.Number(),
  playbackState: t.Union([t.Literal("playing"), t.Literal("paused"), t.Literal("idle")]),
  shuffleEnabled: t.Boolean(),
  repeatMode: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")]),
  trackName: t.String(),
  artistName: t.String(),
  albumName: t.String(),
  progressMs: t.Number(),
  durationMs: t.Number(),
  queueStatus: t.Union([t.Literal("ready"), t.Literal("no-device"), t.Literal("relink-required"), t.Literal("unavailable")]),
  queue: t.Array(
    t.Object({
      trackName: t.String(),
      artistName: t.String(),
      albumName: t.String(),
      type: t.Union([t.Literal("track"), t.Literal("episode"), t.Literal("unknown")])
    })
  ),
  recentUnavailable: t.Boolean(),
  recent: t.Array(
    t.Object({
      id: t.String(),
      trackName: t.String(),
      artistName: t.String(),
      albumName: t.String(),
      uri: t.String(),
      durationMs: t.Number(),
      playedAt: t.String()
    })
  ),
  linked: t.Boolean(),
  relinkRequired: t.Boolean(),
  profile: t.Nullable(cliPlayerProfileSchema)
});

export const cliPlayerSnapshotResponseSchema = t.Object({
  home: cliPlayerHomeSummarySchema,
  warning: t.String()
});

export const cliBootstrapResponseSchema = t.Object({
  home: cliPlayerHomeSummarySchema,
  browse: t.Object({
    featuredPlaylists: t.Array(cliPlaylistSummarySchema),
    playlists: t.Array(cliPlaylistSummarySchema),
    likedTracks: t.Array(cliTrackSummarySchema)
  }),
  warning: t.String()
});

export const cliPlayerActionResponseSchema = t.Object({
  ok: t.Literal(true),
  action: t.Union([
    t.Literal("play"),
    t.Literal("pause"),
    t.Literal("next"),
    t.Literal("previous"),
    t.Literal("shuffle"),
    t.Literal("repeat"),
    t.Literal("volume"),
    t.Literal("transfer"),
    t.Literal("play-track"),
    t.Literal("play-context")
  ])
});

export const cliAuthStartResponseSchema = t.Object({
  authorizeUrl: t.String(),
  state: t.String()
});

export const cliAuthStatusResponseSchema = t.Object({
  linked: t.Boolean(),
  relinkRequired: t.Boolean()
});

export const cliLibraryViewParamsSchema = t.Object({
  libraryId: t.String()
});

export const cliSearchQuerySchema = t.Object({
  q: t.String({ minLength: 1 })
});

export const cliLibraryViewResponseSchema = t.Object({
  section: t.Nullable(
    t.Object({
      id: t.String(),
      title: t.String(),
      items: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          subtitle: t.String(),
          meta: t.Optional(t.String()),
          action: t.Object({
            type: t.Literal("play-track"),
            uri: t.String()
          })
        })
      )
    })
  )
});

export const cliSearchResponseSchema = t.Object({
  tracks: t.Array(cliTrackSummarySchema),
  playlists: t.Array(cliPlaylistSummarySchema),
  albums: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      artistName: t.String(),
      imageUrl: t.String(),
      uri: t.String()
    })
  ),
  artists: t.Array(
    t.Object({
      id: t.String(),
      name: t.String(),
      imageUrl: t.String(),
      uri: t.String()
    })
  )
});

export const cliDevicesResponseSchema = t.Object({
  items: t.Array(cliDeviceSummarySchema)
});

export const cliPlayerActionRequestSchema = t.Union([
  t.Object({ action: t.Literal("play") }),
  t.Object({ action: t.Literal("pause") }),
  t.Object({ action: t.Literal("next") }),
  t.Object({ action: t.Literal("previous") }),
  t.Object({ action: t.Literal("shuffle"), enabled: t.Boolean() }),
  t.Object({ action: t.Literal("repeat"), mode: t.Union([t.Literal("off"), t.Literal("track"), t.Literal("context")]) }),
  t.Object({ action: t.Literal("volume"), volumePercent: t.Number() }),
  t.Object({ action: t.Literal("transfer"), deviceId: t.String() }),
  t.Object({ action: t.Literal("play-track"), uri: t.String() }),
  t.Object({ action: t.Literal("play-context"), contextUri: t.String() })
]);

export const cliAuthCallbackQuerySchema = t.Object({
  code: t.Optional(t.String()),
  state: t.Optional(t.String()),
  error: t.Optional(t.String()),
  error_description: t.Optional(t.String())
});
