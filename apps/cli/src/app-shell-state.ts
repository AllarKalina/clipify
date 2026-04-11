import type { HomeSnapshot } from "./home-state";

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
};

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
  searchQuery: string;
  searchResults: SearchResults;
  searchBusy: boolean;
  searchError: string;
};

export function createInitialShellBrowseState(): ShellBrowseState {
  return {
    recentTracks: [],
    featuredPlaylists: [],
    playlists: [],
    likedTracks: [],
    playlistDetail: null,
    searchQuery: "",
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
    ? "Home"
    : mainView === "search-results"
      ? "Search"
      : mainView === "liked-tracks"
        ? "Liked songs"
        : "Playlist";
}

export function moveSelection(current: number, direction: "up" | "down", itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (direction === "up") {
    return (current - 1 + itemCount) % itemCount;
  }

  return (current + 1) % itemCount;
}

export function flattenSections(sections: ContentSection[]): ContentItem[] {
  return sections.flatMap((section) => section.items);
}

let pinnedPlaylistNameOverrides = new Set<string>();
let pinnedPlaylistNamePriority = new Map<string, number>();

function normalizeSortKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function isPinnedPlaylist(playlist: PlaylistSummary) {
  if (playlist.isPinned === true) {
    return true;
  }

  return pinnedPlaylistNameOverrides.has(normalizeSortKey(playlist.name));
}

export function setPinnedPlaylistNameOverrides(playlistNames: string[]) {
  const normalized = playlistNames.map((name) => normalizeSortKey(name)).filter(Boolean);
  pinnedPlaylistNameOverrides = new Set(normalized);
  pinnedPlaylistNamePriority = new Map(normalized.map((name, index) => [name, index]));
}

export function sortPlaylistsForLibrary(playlists: PlaylistSummary[], ownerNames: string[] = []): PlaylistSummary[] {
  const ownerNameKeys = new Set(ownerNames.map((ownerName) => normalizeSortKey(ownerName)).filter(Boolean));
  const isOwnedByCurrentUser = (playlist: PlaylistSummary) =>
    ownerNameKeys.size > 0 && ownerNameKeys.has(normalizeSortKey(playlist.ownerName));

  return playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((left, right) => {
    const pinRank = Number(isPinnedPlaylist(right.playlist)) - Number(isPinnedPlaylist(left.playlist));
    if (pinRank !== 0) {
      return pinRank;
    }

    if (isPinnedPlaylist(left.playlist) && isPinnedPlaylist(right.playlist)) {
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

export function buildLibrarySidebarItems(state: ShellBrowseState, ownerNames: string[] = []): ContentItem[] {
  const sortedPlaylists = sortPlaylistsForLibrary(state.playlists, ownerNames);
  const pinnedPlaylists = sortedPlaylists.filter((playlist) => isPinnedPlaylist(playlist));
  const unpinnedPlaylists = sortedPlaylists.filter((playlist) => !isPinnedPlaylist(playlist));
  const toLibraryPlaylistItem = (playlist: PlaylistSummary): ContentItem => ({
    id: `library-playlist-${playlist.id}`,
    title: isPinnedPlaylist(playlist) ? `[PIN] ${playlist.name}` : playlist.name,
    subtitle: playlist.ownerName,
    meta: `${playlist.trackCount} tracks`,
    action: { type: "open-playlist", playlistId: playlist.id } as const
  });

  return [
    ...pinnedPlaylists.map(toLibraryPlaylistItem),
    {
      id: "library-liked",
      title: "Liked songs",
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
      subtitle: "Press [l] to refresh permissions",
      meta: "library locked",
      action: { type: "noop" } as const
    }
  ];
}

export function buildHomeSections(homeSnapshot: HomeSnapshot, state: ShellBrowseState): ContentSection[] {
  if (homeSnapshot.spotify !== "linked") {
    return [];
  }

  return [
    {
      id: "quick-launch",
      title: "Quick launch",
      items: state.playlists.slice(0, 6).map((playlist) => ({
        id: `quick-launch-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "play-context", uri: playlist.uri } as const
      }))
    },
    {
      id: "picked",
      title: "Picked for you",
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
      title: "Liked songs",
      items: state.likedTracks.map((track) => ({
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
      items: state.playlistDetail.tracks.map((track) => ({
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
      title: "Tracks",
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
      title: "Playlists",
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
      title: "Albums",
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
      title: "Artists",
      items: state.searchResults.artists.map((artist) => ({
        id: `search-artist-${artist.id}`,
        title: artist.name,
        subtitle: "artist",
        action: { type: "play-context", uri: artist.uri } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}
