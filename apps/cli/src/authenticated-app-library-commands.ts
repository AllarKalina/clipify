import type { ApiClient } from "@clipify/api-client";
import type { ContentAction } from "./app-shell-types";
import type { AuthenticatedCommandContext } from "./authenticated-command-context";
import { toPlaylistDetail, toTrackSummary } from "./authenticated-app-data-mappers";
import { runPlaybackAction } from "./authenticated-app-playback-commands";
import { toMessage } from "./authenticated-app-utils";

async function loadLibrarySection(client: ApiClient, libraryId: string) {
  return client.getCliLibraryView(libraryId);
}

function openPlaylistDetail(
  context: AuthenticatedCommandContext,
  playlistId: string,
  options: { manageBusy?: boolean; showSuccessStatus?: boolean } = {}
) {
  const { client, dispatch, getState } = context;
  const manageBusy = options.manageBusy ?? true;
  const showSuccessStatus = options.showSuccessStatus ?? true;

  if (manageBusy) {
    dispatch({ type: "set-busy", busy: true });
  }

  void loadLibrarySection(client, playlistId)
    .then((detail) => {
      if (!detail.section) {
        throw new Error("Playlist view not available");
      }

      dispatch({
        type: "open-playlist-detail",
        detail: toPlaylistDetail(detail.section, getState().browseState, playlistId)
      });
      if (showSuccessStatus) {
        dispatch({ type: "set-status-line", statusLine: `Opened ${detail.section.title}` });
      }
    })
    .catch((error) => {
      dispatch({ type: "set-status-line", statusLine: `Playlist load failed: ${toMessage(error)}` });
    })
    .finally(() => {
      if (manageBusy) {
        dispatch({ type: "set-busy", busy: false });
      }
    });
}

export function executeOpenContextAction(
  context: AuthenticatedCommandContext,
  action: ContentAction
) {
  if (action.type === "open-liked-tracks") {
    executeContentAction(context, action);
    return;
  }

  if (action.type === "open-playlist") {
    openPlaylistDetail(context, action.playlistId);
    return;
  }

  if (action.type === "play-and-open-playlist") {
    openPlaylistDetail(context, action.playlistId);
    return;
  }

  if (action.type === "play-context") {
    runPlaybackAction(context, "Started context", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-context", contextUri: action.uri })
    );
  }
}

export function executeContentAction(
  context: AuthenticatedCommandContext,
  action: ContentAction
) {
  const { client, dispatch, getState } = context;

  if (action.type === "noop") {
    return;
  }

  if (action.type === "open-liked-tracks") {
    dispatch({ type: "set-busy", busy: true });
    void loadLibrarySection(client, "liked")
      .then((detail) => {
        if (!detail.section) {
          throw new Error("Liked songs view not available");
        }

        dispatch({
          type: "patch-browse-state",
          patch: {
            likedTracks: detail.section.items.map(toTrackSummary)
          }
        });
        dispatch({ type: "open-liked-tracks" });
        dispatch({ type: "set-status-line", statusLine: "Opened Liked songs" });
      })
      .catch((error) => {
        dispatch({ type: "set-status-line", statusLine: `Liked songs load failed: ${toMessage(error)}` });
      })
      .finally(() => {
        dispatch({ type: "set-busy", busy: false });
      });
    return;
  }

  if (action.type === "open-playlist") {
    openPlaylistDetail(context, action.playlistId);
    return;
  }

  if (action.type === "play-and-open-playlist") {
    const alreadyPlayingContext =
      getState().homeSnapshot.playbackState === "playing" && getState().homeSnapshot.contextUri === action.uri;
    if (alreadyPlayingContext) {
      openPlaylistDetail(context, action.playlistId);
      return;
    }

    openPlaylistDetail(context, action.playlistId, { manageBusy: false, showSuccessStatus: false });
    runPlaybackAction(context, "Started playlist", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-context", contextUri: action.uri })
    );
    return;
  }

  if (action.type === "play-track") {
    runPlaybackAction(context, "Started track", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-track", uri: action.uri })
    );
    return;
  }

  if (action.type === "play-context") {
    runPlaybackAction(context, "Started context", (targetClient) =>
      targetClient.runCliPlayerAction({ action: "play-context", contextUri: action.uri })
    );
  }
}
