import type { HomeSnapshot } from "./home-state";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

export type AppFocusRegion = "sidebar" | "content";
export type MainView = "home" | "search-results" | "liked-tracks" | "playlist-detail";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  ownerName: string;
  isPinned?: boolean;
  trackCount: number;
  uri: string;
};

export type TrackSummary = {
  id: string;
  trackName: string;
  artistName: string;
  albumName: string;
  uri: string;
  durationMs: number;
  addedAt?: string;
};

export type TrackSortMode = "original" | "added" | "title" | "artist";
export const TRACK_SORT_MODES: TrackSortMode[] = ["original", "added", "title", "artist"];

export type RecentTrackSummary = TrackSummary & {
  playedAt: string;
};

export type AlbumSummary = {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string;
  uri: string;
};

export type ArtistSummary = {
  id: string;
  name: string;
  imageUrl: string;
  uri: string;
};

export type PlaylistDetail = PlaylistSummary & {
  tracks: TrackSummary[];
};

export type SearchResults = {
  tracks: TrackSummary[];
  playlists: PlaylistSummary[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
};

export type ContentAction =
  | { type: "play-track"; uri: string }
  | { type: "play-context"; uri: string }
  | { type: "play-and-open-playlist"; playlistId: string; uri: string }
  | { type: "open-playlist"; playlistId: string }
  | { type: "open-liked-tracks" }
  | { type: "noop" };

export type ContentItem = {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  action: ContentAction;
};

export type ContentSection = {
  id: string;
  title: string;
  items: ContentItem[];
};

export type ShellBrowseState = {
  recentTracks: RecentTrackSummary[];
  featuredPlaylists: PlaylistSummary[];
  playlists: PlaylistSummary[];
  likedTracks: TrackSummary[];
  playlistDetail: PlaylistDetail | null;
  trackSortMode: TrackSortMode;
  pinnedPlaylistNames: string[];
  searchQuery: string;
  submittedSearchQuery: string;
  searchRequestId: number;
  searchResults: SearchResults;
  searchBusy: boolean;
  searchError: string;
};

export function createInitialShellBrowseState(pinnedPlaylistNames: string[] = []): ShellBrowseState {
  return {
    recentTracks: [],
    featuredPlaylists: [],
    playlists: [],
    likedTracks: [],
    playlistDetail: null,
    trackSortMode: "original",
    pinnedPlaylistNames,
    searchQuery: "",
    submittedSearchQuery: "",
    searchRequestId: 0,
    searchResults: {
      tracks: [],
      playlists: [],
      albums: [],
      artists: []
    },
    searchBusy: false,
    searchError: ""
  };
}

export function getMainViewLabel(mainView: MainView): string {
  return mainView === "home"
    ? iconLabel(NERD_ICONS.home, "Home")
    : mainView === "search-results"
      ? iconLabel(NERD_ICONS.search, "Search")
      : mainView === "liked-tracks"
        ? iconLabel(NERD_ICONS.liked, "Liked songs")
        : iconLabel(NERD_ICONS.playlists, "Playlist");
}

export function moveSelection(current: number, direction: "up" | "down", itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (direction === "up") {
    return Math.max(0, current - 1);
  }

  return Math.min(itemCount - 1, current + 1);
}

export function flattenSections(sections: ContentSection[]): ContentItem[] {
  return sections.flatMap((section) => section.items);
}

export function getTrackSortLabel(sortMode: TrackSortMode): string {
  return sortMode === "title" ? "title" : sortMode === "artist" ? "artist" : sortMode === "added" ? "recent" : "playlist";
}

function normalizeSortKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getAddedAtTime(track: TrackSummary): number {
  if (!track.addedAt) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = Date.parse(track.addedAt);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function sortTracks(tracks: TrackSummary[], sortMode: TrackSortMode): TrackSummary[] {
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

export function buildLibrarySidebarItems(
  state: ShellBrowseState,
  pinnedPlaylistNames: string[] = [],
  ownerNames: string[] = []
): ContentItem[] {
  const { isPinnedPlaylist } = createPinnedPlaylistMetadata(pinnedPlaylistNames);
  const sortedPlaylists = sortPlaylistsForLibrary(state.playlists, pinnedPlaylistNames, ownerNames);
  const pinnedPlaylists = sortedPlaylists.filter((playlist) => isPinnedPlaylist(playlist));
  const unpinnedPlaylists = sortedPlaylists.filter((playlist) => !isPinnedPlaylist(playlist));
  const toLibraryPlaylistItem = (playlist: PlaylistSummary): ContentItem => ({
    id: `library-playlist-${playlist.id}`,
    title: isPinnedPlaylist(playlist) ? iconLabel(NERD_ICONS.pin, playlist.name) : playlist.name,
    subtitle: playlist.ownerName,
    meta: `${playlist.trackCount} tracks`,
    action: { type: "open-playlist", playlistId: playlist.id } as const
  });

  return [
    ...pinnedPlaylists.map(toLibraryPlaylistItem),
    {
      id: "library-liked",
      title: iconLabel(NERD_ICONS.liked, "Liked songs"),
      subtitle: `${state.likedTracks.length} saved tracks`,
      meta: "library",
      action: { type: "open-liked-tracks" } as const
    },
    ...unpinnedPlaylists.map(toLibraryPlaylistItem)
  ];
}

export function buildRelinkRequiredSidebarItems(): ContentItem[] {
  return [
    {
      id: "library-relink",
      title: "Spotify re-link required",
      subtitle: "Press [cmd+s] then [l] to refresh permissions",
      meta: "library locked",
      action: { type: "noop" } as const
    }
  ];
}

export function buildHomeSections(homeSnapshot: HomeSnapshot, state: ShellBrowseState): ContentSection[] {
  if (homeSnapshot.spotify !== "linked") {
    return [];
  }

  const quickLaunchPlaylists = sortPlaylistsForLibrary(state.playlists, state.pinnedPlaylistNames, [
    homeSnapshot.spotifyDisplayName,
    homeSnapshot.userName
  ]).slice(0, 6);

  return [
    {
      id: "quick-launch",
      title: iconLabel(NERD_ICONS.quickLaunch, "Quick launch"),
      items: quickLaunchPlaylists.map((playlist) => ({
        id: `quick-launch-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "play-and-open-playlist", playlistId: playlist.id, uri: playlist.uri } as const
      }))
    },
    {
      id: "picked",
      title: iconLabel(NERD_ICONS.picked, "Picked for you"),
      items: state.featuredPlaylists.slice(0, 6).map((playlist) => ({
        id: `picked-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}

export function buildLikedTracksSections(state: ShellBrowseState): ContentSection[] {
  return [
    {
      id: "liked-tracks",
      title: iconLabel(NERD_ICONS.liked, "Liked songs"),
      items: sortTracks(state.likedTracks, state.trackSortMode).map((track) => ({
        id: `liked-${track.id || track.uri}`,
        title: track.trackName,
        subtitle: track.artistName,
        meta: track.albumName,
        action: { type: "play-track", uri: track.uri } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}

export function buildPlaylistDetailSections(state: ShellBrowseState): ContentSection[] {
  if (!state.playlistDetail) {
    return [];
  }

  return [
    {
      id: "playlist-tracks",
      title: state.playlistDetail.name,
      items: sortTracks(state.playlistDetail.tracks, state.trackSortMode).map((track) => ({
        id: `playlist-track-${track.id || track.uri}`,
        title: track.trackName,
        subtitle: track.artistName,
        meta: track.albumName,
        action: { type: "play-track", uri: track.uri } as const
      }))
    }
  ];
}

export function buildSearchSections(state: ShellBrowseState): ContentSection[] {
  return [
    {
      id: "tracks",
      title: iconLabel(NERD_ICONS.tracks, "Tracks"),
      items: state.searchResults.tracks.map((track) => ({
        id: `search-track-${track.id || track.uri}`,
        title: track.trackName,
        subtitle: track.artistName,
        meta: track.albumName,
        action: { type: "play-track", uri: track.uri } as const
      }))
    },
    {
      id: "playlists",
      title: iconLabel(NERD_ICONS.playlists, "Playlists"),
      items: state.searchResults.playlists.map((playlist) => ({
        id: `search-playlist-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
      }))
    },
    {
      id: "albums",
      title: iconLabel(NERD_ICONS.album, "Albums"),
      items: state.searchResults.albums.map((album) => ({
        id: `search-album-${album.id}`,
        title: album.name,
        subtitle: album.artistName,
        meta: "album",
        action: { type: "play-context", uri: album.uri } as const
      }))
    },
    {
      id: "artists",
      title: iconLabel(NERD_ICONS.artist, "Artists"),
      items: state.searchResults.artists.map((artist) => ({
        id: `search-artist-${artist.id}`,
        title: artist.name,
        subtitle: "artist",
        action: { type: "play-context", uri: artist.uri } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}
