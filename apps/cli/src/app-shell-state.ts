export type AppPage = "home" | "search" | "library" | "playlists";
export type AppFocusRegion = "sidebar" | "content";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  ownerName: string;
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
  | { type: "close-playlist-detail" }
  | { type: "close-liked-tracks" }
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
  libraryView: "overview" | "liked-tracks";
};

export const appPages: AppPage[] = ["home", "search", "library", "playlists"];

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
    searchError: "",
    libraryView: "overview"
  };
}

export function getPageLabel(page: AppPage): string {
  return page === "home"
    ? "Home"
    : page === "search"
      ? "Search"
      : page === "library"
        ? "Library"
        : "Playlists";
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

export function buildHomeSections(state: ShellBrowseState): ContentSection[] {
  return [
    {
      id: "recent",
      title: "Recently played",
      items: state.recentTracks.slice(0, 6).map((track) => ({
        id: `recent-${track.id || track.uri}`,
        title: track.trackName,
        subtitle: track.artistName,
        meta: track.albumName,
        action: { type: "play-track", uri: track.uri } as const
      }))
    },
    {
      id: "featured",
      title: "Browse picks",
      items: state.featuredPlaylists.slice(0, 6).map((playlist) => ({
        id: `featured-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
      }))
    },
    {
      id: "playlists",
      title: "Your playlists",
      items: state.playlists.slice(0, 6).map((playlist) => ({
        id: `playlist-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}

export function buildLibrarySections(state: ShellBrowseState): ContentSection[] {
  if (state.libraryView === "liked-tracks") {
    return [
      {
        id: "liked-header",
        title: "Liked tracks",
        items: [
          {
            id: "liked-back",
            title: "Back to library",
            subtitle: "Return to playlists and entries",
            action: { type: "close-liked-tracks" } as const
          }
        ]
      },
      {
        id: "liked-tracks",
        title: "Saved tracks",
        items: state.likedTracks.map((track) => ({
          id: `liked-${track.id || track.uri}`,
          title: track.trackName,
          subtitle: track.artistName,
          meta: track.albumName,
          action: { type: "play-track", uri: track.uri } as const
        }))
      }
    ];
  }

  return [
    {
      id: "entries",
      title: "Your library",
      items: [
        {
          id: "liked-entry",
          title: "Liked songs",
          subtitle: `${state.likedTracks.length} saved tracks`,
          action: { type: "open-liked-tracks" } as const
        }
      ]
    },
    {
      id: "library-playlists",
      title: "Your playlists",
      items: state.playlists.map((playlist) => ({
        id: `library-playlist-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
      }))
    }
  ].filter((section) => section.items.length > 0);
}

export function buildPlaylistsSections(state: ShellBrowseState): ContentSection[] {
  if (state.playlistDetail) {
    return [
      {
        id: "playlist-header",
        title: state.playlistDetail.name,
        items: [
          {
            id: "playlist-back",
            title: "Back to playlists",
            subtitle: state.playlistDetail.description || state.playlistDetail.ownerName,
            meta: `${state.playlistDetail.trackCount} tracks`,
            action: { type: "close-playlist-detail" } as const
          }
        ]
      },
      {
        id: "playlist-tracks",
        title: "Tracks",
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

  return [
    {
      id: "playlists",
      title: "Playlists",
      items: state.playlists.map((playlist) => ({
        id: `playlist-list-${playlist.id}`,
        title: playlist.name,
        subtitle: playlist.description || playlist.ownerName,
        meta: `${playlist.trackCount} tracks`,
        action: { type: "open-playlist", playlistId: playlist.id } as const
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
