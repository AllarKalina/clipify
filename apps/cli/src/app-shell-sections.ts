import type { HomeSnapshot } from "./home-state";
import type { ContentItem, ContentSection, PlaylistSummary, ShellBrowseState } from "./app-shell-types";
import { createPinnedPlaylistMatcher, sortPlaylistsForLibrary } from "./app-shell-playlists";
import { sortTracks } from "./app-shell-track-sorting";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

export function buildLibrarySidebarItems(
  state: ShellBrowseState,
  pinnedPlaylistNames: string[] = [],
  ownerNames: string[] = []
): ContentItem[] {
  const isPinnedPlaylist = createPinnedPlaylistMatcher(pinnedPlaylistNames);
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
