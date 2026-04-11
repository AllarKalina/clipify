import { t } from "elysia";

export const cliModelNames = {
  authCallbackQuery: "CliAuthCallbackQuery",
  authStartResponse: "CliAuthStartResponse",
  authStatusResponse: "CliAuthStatusResponse",
  playlistSummary: "CliPlaylistSummary",
  trackSummary: "CliTrackSummary",
  albumSummary: "CliAlbumSummary",
  artistSummary: "CliArtistSummary",
  deviceSummary: "CliDeviceSummary",
  playerProfile: "CliPlayerProfile",
  playerQueueItem: "CliPlayerQueueItem",
  recentTrack: "CliRecentTrack",
  playerHomeSummary: "CliPlayerHomeSummary",
  playerSnapshotResponse: "CliPlayerSnapshotResponse",
  bootstrapBrowse: "CliBootstrapBrowse",
  bootstrapResponse: "CliBootstrapResponse",
  libraryViewParams: "CliLibraryViewParams",
  libraryItemAction: "CliLibraryItemAction",
  libraryItem: "CliLibraryItem",
  librarySection: "CliLibrarySection",
  libraryViewResponse: "CliLibraryViewResponse",
  searchQuery: "CliSearchQuery",
  searchResponse: "CliSearchResponse",
  devicesResponse: "CliDevicesResponse",
  playerActionRequest: "CliPlayerActionRequest",
  playerActionResponse: "CliPlayerActionResponse"
} as const;

export const cliBffModels = {
  [cliModelNames.authCallbackQuery]: t.Object({
    code: t.Optional(t.String()),
    state: t.Optional(t.String()),
    error: t.Optional(t.String()),
    error_description: t.Optional(t.String())
  }),
  [cliModelNames.authStartResponse]: t.Object({
    authorizeUrl: t.String(),
    state: t.String()
  }),
  [cliModelNames.authStatusResponse]: t.Object({
    linked: t.Boolean(),
    relinkRequired: t.Boolean()
  }),
  [cliModelNames.playlistSummary]: t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    imageUrl: t.String(),
    ownerName: t.String(),
    isPinned: t.Optional(t.Boolean()),
    trackCount: t.Number(),
    uri: t.String()
  }),
  [cliModelNames.trackSummary]: t.Object({
    id: t.String(),
    trackName: t.String(),
    artistName: t.String(),
    albumName: t.String(),
    uri: t.String(),
    durationMs: t.Number()
  }),
  [cliModelNames.albumSummary]: t.Object({
    id: t.String(),
    name: t.String(),
    artistName: t.String(),
    imageUrl: t.String(),
    uri: t.String()
  }),
  [cliModelNames.artistSummary]: t.Object({
    id: t.String(),
    name: t.String(),
    imageUrl: t.String(),
    uri: t.String()
  }),
  [cliModelNames.deviceSummary]: t.Object({
    id: t.String(),
    name: t.String(),
    type: t.String(),
    isActive: t.Boolean(),
    isRestricted: t.Boolean(),
    supportsVolume: t.Boolean(),
    volumePercent: t.Number()
  }),
  [cliModelNames.playerProfile]: t.Object({
    id: t.String(),
    displayName: t.String(),
    email: t.String(),
    profileUrl: t.String(),
    imageUrl: t.String()
  }),
  [cliModelNames.playerQueueItem]: t.Object({
    trackName: t.String(),
    artistName: t.String(),
    albumName: t.String(),
    type: t.Union([t.Literal("track"), t.Literal("episode"), t.Literal("unknown")])
  }),
  [cliModelNames.recentTrack]: t.Object({
    id: t.String(),
    trackName: t.String(),
    artistName: t.String(),
    albumName: t.String(),
    uri: t.String(),
    durationMs: t.Number(),
    playedAt: t.String()
  }),
  [cliModelNames.playerHomeSummary]: t.Object({
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
    queue: t.Array(t.Ref(cliModelNames.playerQueueItem)),
    recentUnavailable: t.Boolean(),
    recent: t.Array(t.Ref(cliModelNames.recentTrack)),
    linked: t.Boolean(),
    relinkRequired: t.Boolean(),
    profile: t.Nullable(t.Ref(cliModelNames.playerProfile))
  }),
  [cliModelNames.playerSnapshotResponse]: t.Object({
    home: t.Ref(cliModelNames.playerHomeSummary),
    warning: t.String()
  }),
  [cliModelNames.bootstrapBrowse]: t.Object({
    featuredPlaylists: t.Array(t.Ref(cliModelNames.playlistSummary)),
    playlists: t.Array(t.Ref(cliModelNames.playlistSummary)),
    likedTracks: t.Array(t.Ref(cliModelNames.trackSummary))
  }),
  [cliModelNames.bootstrapResponse]: t.Object({
    home: t.Ref(cliModelNames.playerHomeSummary),
    browse: t.Ref(cliModelNames.bootstrapBrowse),
    warning: t.String()
  }),
  [cliModelNames.libraryViewParams]: t.Object({
    libraryId: t.String()
  }),
  [cliModelNames.libraryItemAction]: t.Object({
    type: t.Literal("play-track"),
    uri: t.String()
  }),
  [cliModelNames.libraryItem]: t.Object({
    id: t.String(),
    title: t.String(),
    subtitle: t.String(),
    meta: t.Optional(t.String()),
    action: t.Ref(cliModelNames.libraryItemAction)
  }),
  [cliModelNames.librarySection]: t.Object({
    id: t.String(),
    title: t.String(),
    items: t.Array(t.Ref(cliModelNames.libraryItem))
  }),
  [cliModelNames.libraryViewResponse]: t.Object({
    section: t.Nullable(t.Ref(cliModelNames.librarySection))
  }),
  [cliModelNames.searchQuery]: t.Object({
    q: t.String({ minLength: 1 })
  }),
  [cliModelNames.searchResponse]: t.Object({
    tracks: t.Array(t.Ref(cliModelNames.trackSummary)),
    playlists: t.Array(t.Ref(cliModelNames.playlistSummary)),
    albums: t.Array(t.Ref(cliModelNames.albumSummary)),
    artists: t.Array(t.Ref(cliModelNames.artistSummary))
  }),
  [cliModelNames.devicesResponse]: t.Object({
    items: t.Array(t.Ref(cliModelNames.deviceSummary))
  }),
  [cliModelNames.playerActionRequest]: t.Union([
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
  ]),
  [cliModelNames.playerActionResponse]: t.Object({
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
  })
} as const;
