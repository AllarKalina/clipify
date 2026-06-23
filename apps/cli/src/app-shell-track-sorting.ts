import type { TrackSortMode, TrackSummary } from "./app-shell-types";

export const TRACK_SORT_MODES: TrackSortMode[] = ["original", "added", "title", "artist"];

export function getTrackSortLabel(sortMode: TrackSortMode): string {
  return sortMode === "title" ? "title" : sortMode === "artist" ? "artist" : sortMode === "added" ? "recent" : "playlist";
}

export function normalizeSortKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getAddedAtTime(track: TrackSummary): number {
  if (!track.addedAt) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = Date.parse(track.addedAt);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

export function sortTracks(tracks: TrackSummary[], sortMode: TrackSortMode): TrackSummary[] {
  if (sortMode === "original") {
    return tracks;
  }

  return tracks
    .map((track, index) => ({ track, index }))
    .sort((left, right) => {
      if (sortMode === "added") {
        const leftTime = getAddedAtTime(left.track);
        const rightTime = getAddedAtTime(right.track);
        const timeRank = rightTime - leftTime;

        if (timeRank !== 0) {
          return timeRank;
        }

        return left.index - right.index;
      }

      const leftValue = sortMode === "title" ? left.track.trackName : left.track.artistName;
      const rightValue = sortMode === "title" ? right.track.trackName : right.track.artistName;
      const valueRank = normalizeSortKey(leftValue).localeCompare(normalizeSortKey(rightValue));

      if (valueRank !== 0) {
        return valueRank;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.track);
}
