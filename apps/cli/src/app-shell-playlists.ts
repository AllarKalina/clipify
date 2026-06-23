import type { PlaylistSummary } from "./app-shell-types";
import { normalizeSortKey } from "./app-shell-track-sorting";

function createPinnedPlaylistMetadata(pinnedPlaylistNames: string[]) {
  const normalized = pinnedPlaylistNames.map((name) => normalizeSortKey(name)).filter(Boolean);
  const pinnedPlaylistNameSet = new Set(normalized);
  const pinnedPlaylistNamePriority = new Map(normalized.map((name, index) => [name, index]));

  function isPinnedPlaylist(playlist: PlaylistSummary) {
    if (playlist.isPinned === true) {
      return true;
    }

    return pinnedPlaylistNameSet.has(normalizeSortKey(playlist.name));
  }

  return {
    isPinnedPlaylist,
    pinnedPlaylistNamePriority
  };
}

export function createPinnedPlaylistMatcher(pinnedPlaylistNames: string[] = []) {
  return createPinnedPlaylistMetadata(pinnedPlaylistNames).isPinnedPlaylist;
}

export function sortPlaylistsForLibrary(
  playlists: PlaylistSummary[],
  pinnedPlaylistNames: string[] = [],
  ownerNames: string[] = []
): PlaylistSummary[] {
  const { isPinnedPlaylist, pinnedPlaylistNamePriority } = createPinnedPlaylistMetadata(pinnedPlaylistNames);
  const ownerNameKeys = new Set(ownerNames.map((ownerName) => normalizeSortKey(ownerName)).filter(Boolean));
  const isOwnedByCurrentUser = (playlist: PlaylistSummary) =>
    ownerNameKeys.size > 0 && ownerNameKeys.has(normalizeSortKey(playlist.ownerName));

  return playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((left, right) => {
      const leftPinned = isPinnedPlaylist(left.playlist);
      const rightPinned = isPinnedPlaylist(right.playlist);
      const pinRank = Number(rightPinned) - Number(leftPinned);
      if (pinRank !== 0) {
        return pinRank;
      }

      if (leftPinned && rightPinned) {
        const leftPriority = pinnedPlaylistNamePriority.get(normalizeSortKey(left.playlist.name)) ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = pinnedPlaylistNamePriority.get(normalizeSortKey(right.playlist.name)) ?? Number.MAX_SAFE_INTEGER;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
      }

      const ownershipRank = Number(isOwnedByCurrentUser(right.playlist)) - Number(isOwnedByCurrentUser(left.playlist));
      if (ownershipRank !== 0) {
        return ownershipRank;
      }

      // Keep Spotify library order when rank is equal.
      return left.index - right.index;
    })
    .map((entry) => entry.playlist);
}
