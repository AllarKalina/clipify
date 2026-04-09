import { ApiClientError, type ApiClient } from "@clipify/api-client";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  advanceAuthForm,
  createAuthFormState,
  getAuthActionOrder,
  getAuthFieldLabel,
  getAuthFieldOrder,
  getAuthTitle,
  getAuthToggleLabel,
  getFocusedValue,
  moveAuthFocus,
  switchAuthMode,
  updateFocusedValue,
  type AuthActionKey,
  type AuthFieldKey,
  type AuthFormState
} from "./auth-form";
import { getAuthLauncherSelection, submitAuthForm } from "./auth-controller";
import { AuthenticatedShell } from "./app-shell";
import {
  appPages,
  buildHomeSections,
  buildLibrarySections,
  buildPlaylistsSections,
  buildSearchSections,
  createInitialShellBrowseState,
  flattenSections,
  getPageLabel,
  moveSelection,
  type AppFocusRegion,
  type AppPage,
  type ContentAction,
  type ShellBrowseState
} from "./app-shell-state";
import { clearSessionCookie, saveSessionCookie } from "./config";
import {
  applyProgressTick,
  computeHomeSnapshot,
  createInitialHomeSnapshot,
  createPendingAuthenticatedHomeSnapshot,
  refreshPlayerSnapshot,
  shouldBackgroundRefresh,
  shouldTickPlayback,
  type HomeSnapshot
} from "./home-state";

type AppDeps = {
  apiBaseUrl: string;
  initialSessionCookie?: string;
  openBrowser: boolean;
  makeClient: (sessionCookie?: string) => ApiClient;
};

type UnauthMenuAction = "signup" | "login" | "exit";

type LinkFlow = {
  authorizeUrl: string;
};

const spotifyAccentMark = [" ▄██▄ ", "██  ██", " ████ ", "  ▀▀  "] as const;
const controlsPanelWidth = 46;
const brandBlockWidth = 38;
const unauthMenuActions: UnauthMenuAction[] = ["signup", "login", "exit"];
const homeBackgroundRefreshMs = 5000;

function centerText(content: string, width: number): string {
  if (content.length >= width) {
    return content;
  }

  const totalPadding = width - content.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${" ".repeat(leftPadding)}${content}${" ".repeat(rightPadding)}`;
}

function formatUnauthMenuItem(label: string, selected: boolean): string {
  const prefix = selected ? "›" : " ";
  return `${prefix} ${label}`.padEnd(controlsPanelWidth - 4, " ");
}

function nextUnauthSelection(current: UnauthMenuAction, direction: "up" | "down"): UnauthMenuAction {
  const index = unauthMenuActions.indexOf(current);
  if (index < 0) {
    return "signup";
  }

  if (direction === "up") {
    return unauthMenuActions[(index - 1 + unauthMenuActions.length) % unauthMenuActions.length] ?? "signup";
  }

  return unauthMenuActions[(index + 1) % unauthMenuActions.length] ?? "signup";
}

function BrandPanel({ showSubtitle = true }: { showSubtitle?: boolean }) {
  return (
    <Box flexDirection="column" alignItems="center" width={brandBlockWidth}>
      {spotifyAccentMark.map((line, lineIndex) => (
        <Text key={`brand-logo-line-${lineIndex}`} color={lineIndex < 2 ? "green" : "cyan"}>
          {centerText(line, brandBlockWidth)}
        </Text>
      ))}
      <Text color="green" bold>
        {centerText("CLIPIFY", brandBlockWidth)}
      </Text>
      {showSubtitle ? <Text color="white">{centerText("spotify control for terminal", brandBlockWidth)}</Text> : null}
    </Box>
  );
}

function maskFieldValue(field: AuthFieldKey, value: string, active: boolean): string {
  if (field === "password") {
    return value ? "*".repeat(value.length) : active ? "••••••••" : "";
  }

  return value;
}

function formatPanelRow(content: string): string {
  const width = controlsPanelWidth - 4;
  if (content.length <= width) {
    return content.padEnd(width, " ");
  }

  return `${content.slice(0, Math.max(0, width - 1))}…`;
}

function formatAuthFieldRow(field: AuthFieldKey, value: string, active: boolean): string {
  const label = `${getAuthFieldLabel(field)}:`;
  const renderedValue = maskFieldValue(field, value, active) || (active ? "…" : "");
  return formatPanelRow(`${label.padEnd(11, " ")}${renderedValue}`);
}

function formatAuthActionRow(label: string): string {
  return formatPanelRow(`> ${label}`);
}

function renderFocusableRow(content: string, selected: boolean) {
  return (
    <Text color={selected ? "black" : "white"} backgroundColor={selected ? "cyan" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

function AuthPanel({
  authForm,
  busy
}: {
  authForm: AuthFormState;
  busy: boolean;
}) {
  const fields = getAuthFieldOrder(authForm.mode);
  const actions = getAuthActionOrder(authForm.mode);
  const helperText = authForm.focus.kind === "field" ? "[↑↓] move  [esc] back  [enter] next" : "[↑↓] move  [esc] back  [enter] choose";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} width={controlsPanelWidth}>
      <Text color="cyan" bold>
        {getAuthTitle(authForm.mode)}
      </Text>
      <Text color="white">{authForm.mode === "signup" ? "Set up your local session" : "Resume your local session"}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Fields</Text>
        {fields.map((field) => {
          const selected = authForm.focus.kind === "field" && authForm.focus.field === field;
          return (
            <React.Fragment key={field}>
              {renderFocusableRow(formatAuthFieldRow(field, authForm.values[field], selected), selected)}
            </React.Fragment>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Actions</Text>
        {actions.map((action) => {
          const selected = authForm.focus.kind === "action" && authForm.focus.action === action;
          let label = "Submit";

          if (action === "switch-mode") {
            label = getAuthToggleLabel(authForm.mode);
          }

          if (action === "back") {
            label = "Back";
          }

          return <React.Fragment key={action}>{renderFocusableRow(formatAuthActionRow(label), selected)}</React.Fragment>;
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="white">{helperText}</Text>
        {busy ? <Text color="yellow">submitting...</Text> : null}
        {!busy && authForm.message ? (
          <Text color={authForm.message.tone === "error" ? "red" : "cyan"}>{authForm.message.text}</Text>
        ) : null}
      </Box>
    </Box>
  );
}

function ControlsPanel({
  unauthSelection,
  helperLine,
  busy,
  statusLine,
  authForm
}: {
  unauthSelection: UnauthMenuAction;
  helperLine: string;
  busy: boolean;
  statusLine: string;
  authForm: AuthFormState | null;
}) {
  const showStatus = busy || Boolean(statusLine);

  if (authForm) {
    return <AuthPanel authForm={authForm} busy={busy} />;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} width={controlsPanelWidth}>
      <Text color="cyan" bold>
        Launcher
      </Text>
      <Text color="white">Session entry</Text>
      <Box marginTop={1} flexDirection="column">
        <Text
          color={unauthSelection === "signup" ? "black" : "white"}
          backgroundColor={unauthSelection === "signup" ? "cyan" : undefined}
          bold={unauthSelection === "signup"}
        >
          {formatUnauthMenuItem("Create account", unauthSelection === "signup")}
        </Text>
        <Text
          color={unauthSelection === "login" ? "black" : "white"}
          backgroundColor={unauthSelection === "login" ? "cyan" : undefined}
          bold={unauthSelection === "login"}
        >
          {formatUnauthMenuItem("Log in", unauthSelection === "login")}
        </Text>
        <Text
          color={unauthSelection === "exit" ? "black" : "white"}
          backgroundColor={unauthSelection === "exit" ? "cyan" : undefined}
          bold={unauthSelection === "exit"}
        >
          {formatUnauthMenuItem("Quit", unauthSelection === "exit")}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="white">{helperLine}</Text>
        {showStatus ? <Text color={busy ? "yellow" : "cyan"}>{busy ? "working..." : `status: ${statusLine}`}</Text> : null}
      </Box>
    </Box>
  );
}

function openUrl(url: string): boolean {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const result = Bun.spawnSync(command, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    });

    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nextRepeatMode(mode: HomeSnapshot["repeatMode"]): HomeSnapshot["repeatMode"] {
  if (mode === "off") {
    return "context";
  }

  if (mode === "context") {
    return "track";
  }

  return "off";
}

function getPlaybackFailureMessage(error: unknown, fallbackLabel: string): string {
  const apiError = error as ApiClientError;
  if (apiError?.name !== "ApiClientError") {
    return `${fallbackLabel} failed: ${toMessage(error)}`;
  }

  if (apiError.status === 403 && apiError.message.includes("fresh Spotify re-link")) {
    return "Playback control needs a fresh Spotify re-link. Press [l].";
  }

  return apiError.message.replace(/^Request failed for [^:]+:\s*\d+\s*/u, "") || `${fallbackLabel} failed`;
}

function getPageItemCount(page: AppPage, browse: ShellBrowseState): number {
  const sections =
    page === "home"
      ? buildHomeSections(browse)
      : page === "search"
        ? buildSearchSections(browse)
        : page === "library"
          ? buildLibrarySections(browse)
          : buildPlaylistsSections(browse);

  return flattenSections(sections).length;
}

async function loadBrowseShell(client: ApiClient, current: ShellBrowseState): Promise<ShellBrowseState> {
  const [featured, playlists, liked] = await Promise.allSettled([
    client.getSpotifyFeaturedPlaylists(),
    client.getSpotifyPlaylists(),
    client.getSpotifySavedTracks()
  ]);

  return {
    ...current,
    featuredPlaylists: featured.status === "fulfilled" ? featured.value.items : current.featuredPlaylists,
    playlists: playlists.status === "fulfilled" ? playlists.value.items : current.playlists,
    likedTracks: liked.status === "fulfilled" ? liked.value.items : current.likedTracks
  };
}

async function loadPlaylistDetail(client: ApiClient, playlistId: string) {
  return client.getSpotifyPlaylist(playlistId);
}

function App(props: AppDeps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const stdoutWidth = stdout.columns ?? 120;
  const stdoutHeight = stdout.rows ?? 40;
  const showSubtitle = stdoutHeight >= 20;
  const helperLine = stdoutHeight >= 22 ? "[↑↓] navigate  [enter] select" : "[↑↓] move  [enter] select";
  const [sessionCookie, setSessionCookie] = useState<string | undefined>(props.initialSessionCookie);
  const [homeSnapshot, setHomeSnapshot] = useState<HomeSnapshot>(() =>
    props.initialSessionCookie ? createPendingAuthenticatedHomeSnapshot() : createInitialHomeSnapshot()
  );
  const [authForm, setAuthForm] = useState<AuthFormState | null>(null);
  const [linkFlow, setLinkFlow] = useState<LinkFlow | null>(null);
  const [statusLine, setStatusLine] = useState(() => (props.initialSessionCookie ? "Restoring session..." : ""));
  const [busy, setBusy] = useState(false);
  const [unauthSelection, setUnauthSelection] = useState<UnauthMenuAction>("signup");
  const [progressTickMs, setProgressTickMs] = useState(0);
  const [appPage, setAppPage] = useState<AppPage>("home");
  const [focusRegion, setFocusRegion] = useState<AppFocusRegion>("content");
  const [contentIndex, setContentIndex] = useState(0);
  const [browseState, setBrowseState] = useState<ShellBrowseState>(() => createInitialShellBrowseState());
  const [searchEditing, setSearchEditing] = useState(false);

  const client = useMemo(() => props.makeClient(sessionCookie), [props, sessionCookie]);
  const isAuthenticated = Boolean(sessionCookie);
  const backgroundRefreshInFlight = useRef(false);
  const playerModeMutationsInFlight = useRef(0);
  const homeSnapshotRef = useRef(homeSnapshot);
  const displayedHomeSnapshot = useMemo(() => applyProgressTick(homeSnapshot, progressTickMs), [homeSnapshot, progressTickMs]);

  useEffect(() => {
    homeSnapshotRef.current = homeSnapshot;
  }, [homeSnapshot]);

  const setHomeSnapshotTracked = (next: HomeSnapshot | ((current: HomeSnapshot) => HomeSnapshot)) => {
    setHomeSnapshot((current) => {
      const resolved = typeof next === "function" ? (next as (current: HomeSnapshot) => HomeSnapshot)(current) : next;
      homeSnapshotRef.current = resolved;
      return resolved;
    });
  };

  const refreshWithClient = async (targetClient: ApiClient): Promise<HomeSnapshot> => {
    return refreshWithClientMessage(targetClient, "Refreshed");
  };

  const refreshWithClientMessage = async (targetClient: ApiClient, successLine: string): Promise<HomeSnapshot> => {
    setBusy(true);
    const next = await computeHomeSnapshot(targetClient);
    if (next.failureReason === "unauthorized") {
      completeLocalLogout("Session expired");
      return next;
    }

    setHomeSnapshotTracked(next);
    setBrowseState((current) => ({
      ...current,
      recentTracks: next.recent
    }));
    setProgressTickMs(0);
    setBusy(false);
    setStatusLine(next.backend === "connected" ? successLine : "Backend unreachable or unauthorized");
    if (next.backend === "connected" && next.spotify === "linked") {
      try {
        const loadedBrowse = await loadBrowseShell(targetClient, {
          ...browseState,
          recentTracks: next.recent
        });
        setBrowseState(loadedBrowse);
      } catch {}
    }
    return next;
  };

  const refresh = async () => refreshWithClient(client);

  const refreshSilentlyWithClient = async (targetClient: ApiClient): Promise<void> => {
    const next = await refreshPlayerSnapshot(targetClient, homeSnapshotRef.current);
    if (next.failureReason === "unauthorized") {
      completeLocalLogout("Session expired");
      return;
    }

    if (next.backend !== "connected") {
      return;
    }

    setHomeSnapshotTracked(next);
    setProgressTickMs(0);
  };

  const completeLocalLogout = (successLine: string) => {
    clearSessionCookie();
    setSessionCookie(undefined);
    setHomeSnapshotTracked(createInitialHomeSnapshot());
    setBrowseState(createInitialShellBrowseState());
    setAuthForm(null);
    setLinkFlow(null);
    setBusy(false);
    setProgressTickMs(0);
    setUnauthSelection("login");
    setAppPage("home");
    setFocusRegion("content");
    setContentIndex(0);
    setSearchEditing(false);
    setStatusLine(successLine);
  };

  const startSpotifyLinkFlow = async (targetClient: ApiClient) => {
    try {
      const start = await targetClient.startSpotifyAuthorization();
      setLinkFlow(start);

      if (props.openBrowser) {
        const opened = openUrl(start.authorizeUrl);
        setStatusLine(
          opened
            ? "Opened Spotify auth in browser. Waiting for callback..."
            : "Could not open browser. Open authorize URL manually."
        );
      } else {
        setStatusLine("Open authorize URL in a browser. Waiting for callback...");
      }
    } catch (error) {
      setStatusLine(`Link start failed: ${toMessage(error)}`);
    }
  };

  const completeAuthenticatedOnboarding = async (nextSessionCookie: string, successLine: string) => {
    setSessionCookie(nextSessionCookie);
    setHomeSnapshotTracked(createPendingAuthenticatedHomeSnapshot());
    setAuthForm(null);
    setStatusLine(successLine);

    const authenticatedClient = props.makeClient(nextSessionCookie);
    const refreshedHomeSnapshot = await refreshWithClient(authenticatedClient);
    if (refreshedHomeSnapshot.spotify === "not-linked") {
      setStatusLine(`${successLine}. Starting Spotify link...`);
      await startSpotifyLinkFlow(authenticatedClient);
    }
  };

  const runPlaybackAction = (label: string, action: (targetClient: ApiClient) => Promise<unknown>) => {
    setBusy(true);
    void (async () => {
      try {
        await action(client);
        await refreshWithClientMessage(client, label);
      } catch (error) {
        setBusy(false);
        setStatusLine(getPlaybackFailureMessage(error, label));
      }
    })();
  };

  const runOptimisticPlayerModeAction = (
    label: string,
    applyOptimisticUpdate: (current: HomeSnapshot) => HomeSnapshot,
    action: (targetClient: ApiClient) => Promise<unknown>
  ) => {
    playerModeMutationsInFlight.current += 1;
    setHomeSnapshotTracked((current) => applyOptimisticUpdate(current));
    setStatusLine(label);

    void (async () => {
      try {
        await action(client);
      } catch (error) {
        playerModeMutationsInFlight.current = Math.max(0, playerModeMutationsInFlight.current - 1);
        await refreshSilentlyWithClient(client);
        setStatusLine(getPlaybackFailureMessage(error, label));
        return;
      }

      playerModeMutationsInFlight.current = Math.max(0, playerModeMutationsInFlight.current - 1);
      if (playerModeMutationsInFlight.current > 0) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshSilentlyWithClient(client);
    })();
  };

  const executeContentAction = (action: ContentAction) => {
    if (action.type === "noop") {
      return;
    }

    if (action.type === "open-liked-tracks") {
      setBrowseState((current) => ({
        ...current,
        libraryView: "liked-tracks"
      }));
      setAppPage("library");
      setContentIndex(0);
      return;
    }

    if (action.type === "close-liked-tracks") {
      setBrowseState((current) => ({
        ...current,
        libraryView: "overview"
      }));
      setAppPage("library");
      setContentIndex(0);
      return;
    }

    if (action.type === "close-playlist-detail") {
      setBrowseState((current) => ({
        ...current,
        playlistDetail: null
      }));
      setAppPage("playlists");
      setContentIndex(0);
      return;
    }

    if (action.type === "open-playlist") {
      setBusy(true);
      void loadPlaylistDetail(client, action.playlistId)
        .then((detail) => {
          setBrowseState((current) => ({
            ...current,
            playlistDetail: detail
          }));
          setAppPage("playlists");
          setContentIndex(0);
          setStatusLine(`Opened ${detail.name}`);
        })
        .catch((error) => {
          setStatusLine(`Playlist load failed: ${toMessage(error)}`);
        })
        .finally(() => {
          setBusy(false);
        });
      return;
    }

    if (action.type === "play-track") {
      runPlaybackAction("Started track", (targetClient) => targetClient.playSpotifyTrack(action.uri));
      return;
    }

    if (action.type === "play-context") {
      runPlaybackAction("Started context", (targetClient) => targetClient.playSpotifyContext(action.uri));
    }
  };

  useEffect(() => {
    if (!sessionCookie) {
      return;
    }

    void refresh();
  }, [client, sessionCookie]);

  useEffect(() => {
    setContentIndex(0);
    setSearchEditing(false);
  }, [appPage]);

  useEffect(() => {
    const count = getPageItemCount(appPage, browseState);
    if (contentIndex >= count) {
      setContentIndex(Math.max(0, count - 1));
    }
  }, [appPage, browseState, contentIndex]);

  useEffect(() => {
    if (!isAuthenticated || appPage !== "search" || !browseState.searchQuery.trim()) {
      return;
    }

    const timeout = setTimeout(() => {
      setBrowseState((current) => ({
        ...current,
        searchBusy: true,
        searchError: ""
      }));

      void client
        .searchSpotify(browseState.searchQuery.trim())
        .then((results) => {
          setBrowseState((current) => ({
            ...current,
            searchBusy: false,
            searchResults: results,
            searchError: ""
          }));
          setContentIndex(0);
        })
        .catch((error) => {
          setBrowseState((current) => ({
            ...current,
            searchBusy: false,
            searchError: toMessage(error),
            searchResults: { tracks: [], playlists: [], albums: [], artists: [] }
          }));
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [appPage, browseState.searchQuery, client, isAuthenticated]);

  useEffect(() => {
    setProgressTickMs(0);
  }, [
    homeSnapshot.trackName,
    homeSnapshot.artistName,
    homeSnapshot.albumName,
    homeSnapshot.progressMs,
    homeSnapshot.durationMs,
    homeSnapshot.playbackState
  ]);

  useEffect(() => {
    if (!shouldTickPlayback(homeSnapshot)) {
      return;
    }

    const interval = setInterval(() => {
      setProgressTickMs((current) => Math.min(homeSnapshot.durationMs, current + 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [homeSnapshot]);

  useEffect(() => {
    if (!isAuthenticated || linkFlow || busy || !shouldBackgroundRefresh(homeSnapshot)) {
      return;
    }

    const interval = setInterval(() => {
      if (backgroundRefreshInFlight.current || playerModeMutationsInFlight.current > 0) {
        return;
      }

      backgroundRefreshInFlight.current = true;
      void refreshSilentlyWithClient(client).finally(() => {
        backgroundRefreshInFlight.current = false;
      });
    }, homeBackgroundRefreshMs);

    return () => clearInterval(interval);
  }, [busy, client, homeSnapshot, isAuthenticated, linkFlow]);

  useEffect(() => {
    if (!linkFlow) {
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        try {
          const status = await client.getSpotifyAuthorizationStatus();
          if (!status.linked) {
            return;
          }

          setStatusLine("Spotify linked");
          setLinkFlow(null);
          await refresh();
        } catch (error) {
          setStatusLine(`Link status failed: ${toMessage(error)}`);
        }
      })();
    }, 1500);

    return () => clearInterval(interval);
  }, [client, linkFlow]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (busy) {
      return;
    }

    if (authForm) {
      if (key.escape) {
        setAuthForm(null);
        setStatusLine("");
        setUnauthSelection(getAuthLauncherSelection(authForm.mode));
        return;
      }

      if (key.upArrow) {
        setAuthForm((current) => (current ? moveAuthFocus(current, "up") : current));
        return;
      }

      if (key.downArrow) {
        setAuthForm((current) => (current ? moveAuthFocus(current, "down") : current));
        return;
      }

      if (key.backspace || key.delete) {
        setAuthForm((current) => {
          if (!current || current.focus.kind !== "field") {
            return current;
          }

          return updateFocusedValue(current, getFocusedValue(current).slice(0, -1));
        });
        return;
      }

      if (key.return) {
        if (authForm.focus.kind === "field") {
          setAuthForm((current) => (current ? advanceAuthForm(current) : current));
          return;
        }

        if (authForm.focus.action === "switch-mode") {
          setAuthForm((current) => (current ? switchAuthMode(current) : current));
          return;
        }

        if (authForm.focus.action === "back") {
          setAuthForm(null);
          setStatusLine("");
          setUnauthSelection(getAuthLauncherSelection(authForm.mode));
          return;
        }

        setBusy(true);
        void (async () => {
          try {
            const result = await submitAuthForm(authForm, {
              client,
              persistSession: saveSessionCookie
            });

            if (result.kind === "error") {
              setAuthForm(result.form);
              return;
            }

            await completeAuthenticatedOnboarding(result.sessionCookie, result.successLine);
          } finally {
            setBusy(false);
          }
        })();
        return;
      }

      if (input && !key.tab && authForm.focus.kind === "field") {
        setAuthForm((current) => (current ? updateFocusedValue(current, `${getFocusedValue(current)}${input}`) : current));
      }
      return;
    }

    if (input === "q" && (!isAuthenticated || !searchEditing)) {
      exit();
      return;
    }

    if (!isAuthenticated) {
      if (key.upArrow || key.leftArrow) {
        setUnauthSelection((current) => nextUnauthSelection(current, "up"));
        return;
      }

      if (key.downArrow || key.rightArrow) {
        setUnauthSelection((current) => nextUnauthSelection(current, "down"));
        return;
      }

      if (key.return) {
        if (unauthSelection === "exit") {
          exit();
          return;
        }

        setAuthForm(createAuthFormState(unauthSelection === "signup" ? "signup" : "login"));
        setStatusLine("");
        return;
      }

      return;
    }

    const activeSections =
      appPage === "home"
        ? buildHomeSections(browseState)
        : appPage === "search"
          ? buildSearchSections(browseState)
          : appPage === "library"
            ? buildLibrarySections(browseState)
            : buildPlaylistsSections(browseState);
    const activeItems = flattenSections(activeSections);

    if (key.tab) {
      setFocusRegion((current) => (current === "sidebar" ? "content" : "sidebar"));
      return;
    }

    if (searchEditing && appPage === "search") {
      if (key.escape) {
        setSearchEditing(false);
        return;
      }

      if (key.backspace || key.delete) {
        setBrowseState((current) => ({
          ...current,
          searchQuery: current.searchQuery.slice(0, -1)
        }));
        return;
      }

      if (key.return) {
        setSearchEditing(false);
        return;
      }

      if (input && !key.ctrl) {
        setBrowseState((current) => ({
          ...current,
          searchQuery: `${current.searchQuery}${input}`
        }));
      }
      return;
    }

    if (input === "o") {
      setBusy(true);
      void (async () => {
        try {
          await client.signOut();
          completeLocalLogout("Logged out");
        } catch (error) {
          setBusy(false);
          setStatusLine(`Logout failed: ${toMessage(error)}`);
        }
      })();
      return;
    }

    if (focusRegion === "sidebar") {
      if (key.upArrow) {
        setAppPage((current) => appPages[moveSelection(appPages.indexOf(current), "up", appPages.length)] ?? "home");
        return;
      }

      if (key.downArrow) {
        setAppPage((current) => appPages[moveSelection(appPages.indexOf(current), "down", appPages.length)] ?? "home");
        return;
      }

      if (key.rightArrow || key.return) {
        setFocusRegion("content");
        return;
      }
    }

    if (focusRegion === "content") {
      if (key.leftArrow) {
        setFocusRegion("sidebar");
        return;
      }

      if (key.upArrow) {
        setContentIndex((current) => moveSelection(current, "up", activeItems.length));
        return;
      }

      if (key.downArrow) {
        setContentIndex((current) => moveSelection(current, "down", activeItems.length));
        return;
      }

      if (appPage === "search" && (input === "/" || (key.return && activeItems.length === 0))) {
        setSearchEditing(true);
        return;
      }

      if (key.return && activeItems.length > 0) {
        const item = activeItems[contentIndex];
        if (item) {
          executeContentAction(item.action);
        }
        return;
      }
    }

    if (input === "r") {
      void refresh();
      return;
    }

    if (input === " ") {
      runPlaybackAction(
        homeSnapshot.playbackState === "playing" ? "Paused playback" : "Started playback",
        (targetClient) => (homeSnapshot.playbackState === "playing" ? targetClient.pauseSpotify() : targetClient.playSpotify())
      );
      return;
    }

    if (input === ",") {
      runPlaybackAction("Moved to previous track", (targetClient) => targetClient.previousSpotify());
      return;
    }

    if (input === ".") {
      runPlaybackAction("Moved to next track", (targetClient) => targetClient.nextSpotify());
      return;
    }

    if (input === "s") {
      const enabled = !homeSnapshotRef.current.shuffleEnabled;
      runOptimisticPlayerModeAction(
        enabled ? "Shuffle on" : "Shuffle off",
        (current) => ({
          ...current,
          shuffleEnabled: enabled
        }),
        (targetClient) => targetClient.setSpotifyShuffle(enabled)
      );
      return;
    }

    if (input === "t") {
      const mode = nextRepeatMode(homeSnapshotRef.current.repeatMode);
      runOptimisticPlayerModeAction(
        `Repeat ${mode === "context" ? "all" : mode}`,
        (current) => ({
          ...current,
          repeatMode: mode
        }),
        (targetClient) => targetClient.setSpotifyRepeatMode(mode)
      );
      return;
    }

    if (input === "-" || input === "_") {
      const nextVolume = Math.max(0, homeSnapshotRef.current.volumePercent - 10);
      runOptimisticPlayerModeAction(
        `Volume ${nextVolume}%`,
        (current) => ({
          ...current,
          volumePercent: nextVolume
        }),
        (targetClient) => targetClient.setSpotifyVolume(nextVolume)
      );
      return;
    }

    if (input === "=" || input === "+") {
      const nextVolume = Math.min(100, homeSnapshotRef.current.volumePercent + 10);
      runOptimisticPlayerModeAction(
        `Volume ${nextVolume}%`,
        (current) => ({
          ...current,
          volumePercent: nextVolume
        }),
        (targetClient) => targetClient.setSpotifyVolume(nextVolume)
      );
      return;
    }

    if (input === "l") {
      setBusy(true);
      void (async () => {
        try {
          await startSpotifyLinkFlow(client);
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
  });

  if (!isAuthenticated) {
    return (
      <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight} justifyContent="center" alignItems="center">
        <BrandPanel showSubtitle={showSubtitle} />
        <Box marginTop={1}>
          <ControlsPanel
            unauthSelection={unauthSelection}
            helperLine={helperLine}
            busy={busy}
            statusLine={statusLine}
            authForm={authForm}
          />
        </Box>
      </Box>
    );
  }

  return (
    <AuthenticatedShell
      page={appPage}
      focusRegion={focusRegion}
      contentIndex={contentIndex}
      player={displayedHomeSnapshot}
      browse={browseState}
      width={stdoutWidth}
      height={stdoutHeight}
      busy={busy}
      statusLine={statusLine}
      searchEditing={searchEditing}
      linkPending={Boolean(linkFlow)}
    />
  );
}

export async function runTerminalApp(deps: AppDeps): Promise<void> {
  const instance = render(<App {...deps} />);

  await new Promise<void>((resolve) => {
    instance.waitUntilExit().then(resolve);
  });
}
