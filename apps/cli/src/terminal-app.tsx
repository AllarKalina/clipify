import type { ApiClient, ApiClientError } from "@clipify/api-client";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import React, { useEffect, useMemo, useState } from "react";
import {
  advanceAuthForm,
  createAuthFormState,
  focusFirstInvalidField,
  getAuthActionOrder,
  getAuthFieldLabel,
  getAuthFieldOrder,
  getAuthTitle,
  getAuthToggleLabel,
  getFocusedValue,
  moveAuthFocus,
  switchAuthMode,
  updateFocusedValue,
  validateAuthForm,
  type AuthActionKey,
  type AuthFieldKey,
  type AuthFormState
} from "./auth-form";
import { clearSessionCookie, saveSessionCookie } from "./config";

type AppDeps = {
  apiBaseUrl: string;
  initialSessionCookie?: string;
  openBrowser: boolean;
  makeClient: (sessionCookie?: string) => ApiClient;
};

type Snapshot = {
  backend: "connected" | "offline";
  user: string;
  spotify: "linked" | "not-linked" | "unknown";
  spotifyProfile: string;
  nowPlaying: string;
  error?: string;
};

type UnauthMenuAction = "signup" | "login" | "exit";

type LinkFlow = {
  authorizeUrl: string;
};

function createInitialSnapshot(): Snapshot {
  return {
    backend: "offline",
    user: "loading",
    spotify: "unknown",
    spotifyProfile: "loading",
    nowPlaying: "loading"
  };
}

const spotifyAccentMark = [" ▄██▄ ", "██  ██", " ████ ", "  ▀▀  "] as const;
const controlsPanelWidth = 46;
const brandBlockWidth = 38;
const unauthMenuActions: UnauthMenuAction[] = ["signup", "login", "exit"];

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

function formatAuthFieldRow(field: AuthFieldKey, value: string, active: boolean): string {
  const label = `${getAuthFieldLabel(field)}:`;
  const renderedValue = maskFieldValue(field, value, active) || (active ? "…" : "");
  return `${label.padEnd(11, " ")}${renderedValue}`;
}

function formatAuthActionRow(label: string): string {
  return `> ${label}`.padEnd(controlsPanelWidth - 4, " ");
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
  const showStatus = busy || statusLine !== "Loading...";

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

function maskCookie(cookie?: string): string {
  if (!cookie) {
    return "none";
  }

  if (cookie.length < 12) {
    return "********";
  }

  return `${cookie.slice(0, 6)}...${cookie.slice(-4)}`;
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

function statusColor(state: Snapshot["backend"] | Snapshot["spotify"]): "green" | "yellow" | "red" {
  if (state === "connected" || state === "linked") {
    return "green";
  }

  if (state === "not-linked") {
    return "yellow";
  }

  return "red";
}

async function computeSnapshot(client: ApiClient): Promise<Snapshot> {
  try {
    const me = await client.getMe();
    let spotifyProfileLine = "n/a";

    try {
      const spotifyProfile = await client.getSpotifyProfile();
      spotifyProfileLine = `${spotifyProfile.displayName} (${spotifyProfile.id})`;
    } catch (error) {
      const apiError = error as ApiClientError;
      if (!(apiError?.name === "ApiClientError" && apiError.status === 409)) {
        throw error;
      }

      return {
        backend: "connected",
        user: `${me.user.name} <${me.user.email}>`,
        spotify: "not-linked",
        spotifyProfile: "n/a",
        nowPlaying: "n/a"
      };
    }

    try {
      const current = await client.getSpotifyCurrentlyPlaying();
      const nowPlaying = current.isPlaying
        ? `${current.trackName} - ${current.artistName} (${current.albumName})`
        : "idle";

      return {
        backend: "connected",
        user: `${me.user.name} <${me.user.email}>`,
        spotify: "linked",
        spotifyProfile: spotifyProfileLine,
        nowPlaying
      };
    } catch (error) {
      const apiError = error as ApiClientError;
      if (apiError?.name === "ApiClientError" && apiError.status === 409) {
        return {
          backend: "connected",
          user: `${me.user.name} <${me.user.email}>`,
          spotify: "not-linked",
          spotifyProfile: "n/a",
          nowPlaying: "n/a"
        };
      }

      throw error;
    }
  } catch (error) {
    return {
      backend: "offline",
      user: "unknown",
      spotify: "unknown",
      spotifyProfile: "unknown",
      nowPlaying: "unknown",
      error: toMessage(error)
    };
  }
}

function App(props: AppDeps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const stdoutWidth = stdout.columns ?? 120;
  const stdoutHeight = stdout.rows ?? 40;
  const showSubtitle = stdoutHeight >= 20;
  const helperLine = stdoutHeight >= 22 ? "[↑↓] navigate  [enter] select" : "[↑↓] move  [enter] select";
  const [sessionCookie, setSessionCookie] = useState<string | undefined>(props.initialSessionCookie);
  const [snapshot, setSnapshot] = useState<Snapshot>(createInitialSnapshot);
  const [authForm, setAuthForm] = useState<AuthFormState | null>(null);
  const [linkFlow, setLinkFlow] = useState<LinkFlow | null>(null);
  const [statusLine, setStatusLine] = useState("Loading...");
  const [busy, setBusy] = useState(false);
  const [unauthSelection, setUnauthSelection] = useState<UnauthMenuAction>("signup");

  const client = useMemo(() => props.makeClient(sessionCookie), [props, sessionCookie]);
  const isAuthenticated = snapshot.backend === "connected";

  const refreshWithClient = async (targetClient: ApiClient): Promise<Snapshot> => {
    setBusy(true);
    const next = await computeSnapshot(targetClient);
    setSnapshot(next);
    setBusy(false);
    setStatusLine(next.backend === "connected" ? "Refreshed" : "Backend unreachable or unauthorized");
    return next;
  };

  const refresh = async () => refreshWithClient(client);

  const completeLocalLogout = (successLine: string) => {
    clearSessionCookie();
    setSessionCookie(undefined);
    setSnapshot(createInitialSnapshot());
    setAuthForm(null);
    setLinkFlow(null);
    setBusy(false);
    setUnauthSelection("login");
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
    saveSessionCookie(nextSessionCookie);
    setSessionCookie(nextSessionCookie);
    setAuthForm(null);
    setStatusLine(successLine);

    const authenticatedClient = props.makeClient(nextSessionCookie);
    const refreshedSnapshot = await refreshWithClient(authenticatedClient);
    if (refreshedSnapshot.spotify === "not-linked") {
      setStatusLine(`${successLine}. Starting Spotify link...`);
      await startSpotifyLinkFlow(authenticatedClient);
    }
  };

  useEffect(() => {
    if (!sessionCookie) {
      return;
    }

    void refresh();
  }, [client, sessionCookie]);

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
        setStatusLine("Loading...");
        setUnauthSelection(authForm.mode === "signup" ? "signup" : "login");
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
          setStatusLine("Loading...");
          setUnauthSelection(authForm.mode === "signup" ? "signup" : "login");
          return;
        }

        const validationError = validateAuthForm(authForm);
        if (validationError) {
          setAuthForm((current) => (current ? focusFirstInvalidField(current) : current));
          return;
        }

        setBusy(true);
        void (async () => {
          try {
            if (authForm.mode === "signup") {
              const result = await client.signUpWithEmailPassword({
                name: authForm.values.name.trim(),
                email: authForm.values.email.trim(),
                password: authForm.values.password
              });
              await completeAuthenticatedOnboarding(result.sessionCookie, "Sign up successful");
            } else {
              const result = await client.signInWithEmailPassword({
                email: authForm.values.email.trim(),
                password: authForm.values.password
              });
              await completeAuthenticatedOnboarding(result.sessionCookie, "Login successful");
            }
          } catch (error) {
            setAuthForm((current) =>
              current
                ? {
                    ...current,
                    message: {
                      tone: "error",
                      text: authForm.mode === "signup" ? `Sign up failed: ${toMessage(error)}` : `Login failed: ${toMessage(error)}`
                    }
                  }
                : current
            );
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

    if (input === "q") {
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
        setStatusLine("Loading...");
        return;
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

    if (input === "r") {
      void refresh();
      return;
    }

    if (input === "n") {
      setBusy(true);
      void (async () => {
        try {
          const current = await client.getSpotifyCurrentlyPlaying();
          const line = current.isPlaying
            ? `${current.trackName} - ${current.artistName} (${current.albumName})`
            : "idle";
          setStatusLine(`Now playing: ${line}`);
        } catch (error) {
          setStatusLine(`Now-playing failed: ${toMessage(error)}`);
        } finally {
          setBusy(false);
        }
      })();
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
    <Box flexDirection="column" padding={1}>
      <Text color="green">clipify terminal app</Text>
      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        <Text>
          backend: <Text color={statusColor(snapshot.backend)}>{snapshot.backend}</Text>
        </Text>
        <Text>
          spotify: <Text color={statusColor(snapshot.spotify)}>{snapshot.spotify}</Text>
        </Text>
        <Text>user: {snapshot.user}</Text>
        <Text>spotify profile: {snapshot.spotifyProfile}</Text>
        <Text>now playing: {snapshot.nowPlaying}</Text>
        {snapshot.error ? <Text color="red">error: {snapshot.error}</Text> : null}
      </Box>

      {!linkFlow && snapshot.spotify === "not-linked" ? (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="yellow" padding={1}>
          <Text color="yellow">Spotify not linked</Text>
          <Text dimColor>Press [l] to start browser auth. Terminal will auto-detect completion.</Text>
        </Box>
      ) : null}

      {linkFlow ? (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="green" padding={1}>
          <Text color="green">Linking Spotify</Text>
          <Text dimColor>1) Open this URL in browser and approve access:</Text>
          <Text>{linkFlow.authorizeUrl}</Text>
          <Text dimColor>2) Keep this terminal open. Waiting for callback...</Text>
        </Box>
      ) : null}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>keys: [l] link  [n] now playing  [o] logout  [r] refresh  [q] quit</Text>
        <Text color={busy ? "yellow" : "cyan"}>{busy ? "working..." : statusLine}</Text>
        <Text dimColor>api: {props.apiBaseUrl}</Text>
        <Text dimColor>cookie: {maskCookie(sessionCookie)}</Text>
      </Box>
    </Box>
  );
}

export async function runTerminalApp(deps: AppDeps): Promise<void> {
  const instance = render(<App {...deps} />);

  await new Promise<void>((resolve) => {
    instance.waitUntilExit().then(resolve);
  });
}
