import type { CliLibraryViewResponse, CliPlayerSnapshotResponse } from "@clipify/api-client";
import type { PlaylistDetail, ShellBrowseState, TrackSummary } from "./app-shell-types";
import type { HomeSnapshot } from "./home-state";

export function formatBootstrapWarning(warning: string): string {
  if (!warning) {
    return warning;
  }

  if (!warning.includes("|")) {
    return warning;
  }

  return "Spotify returned partial data. Press [cmd+s] then [r] to refresh.";
}

export function mapCliSnapshotToHome(snapshotHome: CliPlayerSnapshotResponse["home"]): HomeSnapshot {
  return {
    backend: "connected",
    spotify: snapshotHome.spotify,
    userName: snapshotHome.userName,
    userEmail: snapshotHome.userEmail,
    spotifyDisplayName: snapshotHome.spotifyDisplayName,
    deviceId: snapshotHome.deviceId,
    deviceName: snapshotHome.deviceName,
    deviceType: snapshotHome.deviceType,
    deviceStatus: snapshotHome.deviceStatus,
    supportsVolume: snapshotHome.supportsVolume,
    volumePercent: snapshotHome.volumePercent,
    playbackState: snapshotHome.playbackState,
    shuffleEnabled: snapshotHome.shuffleEnabled,
    repeatMode: snapshotHome.repeatMode,
    trackName: snapshotHome.trackName,
    artistName: snapshotHome.artistName,
    albumName: snapshotHome.albumName,
    contextUri: snapshotHome.contextUri,
    progressMs: snapshotHome.progressMs,
    durationMs: snapshotHome.durationMs,
    queueStatus: snapshotHome.queueStatus,
    queue: snapshotHome.queue,
    recentUnavailable: snapshotHome.recentUnavailable,
    recent: snapshotHome.recent
  };
}

export function toTrackSummary(item: NonNullable<CliLibraryViewResponse["section"]>["items"][number]): TrackSummary {
  return {
    id: item.id,
    trackName: item.title,
    artistName: item.subtitle,
    albumName: item.meta ?? "",
    uri: item.action.uri,
    durationMs: 0,
    addedAt: item.addedAt
  };
}

export function toPlaylistDetail(
  section: NonNullable<CliLibraryViewResponse["section"]>,
  current: ShellBrowseState,
  playlistId: string
): PlaylistDetail {
  const playlist = current.playlists.find((item) => item.id === playlistId);
  const tracks = section.items.map(toTrackSummary);

  return {
    id: playlist?.id ?? playlistId,
    name: playlist?.name ?? section.title,
    description: playlist?.description ?? "",
    imageUrl: playlist?.imageUrl ?? "",
    ownerName: playlist?.ownerName ?? "",
    isPinned: playlist?.isPinned,
    trackCount: playlist?.trackCount ?? tracks.length,
    uri: playlist?.uri ?? "",
    tracks
  };
}
