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
