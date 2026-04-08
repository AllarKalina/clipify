import { ApiClientError, type ApiClient } from "@clipify/api-client";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import React, { useEffect, useMemo, useState } from "react";
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
import { clearSessionCookie, saveSessionCookie } from "./config";
import { AuthenticatedHome } from "./home";
import {
  computeHomeSnapshot,
  createInitialHomeSnapshot,
  createPendingAuthenticatedHomeSnapshot,
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

  const client = useMemo(() => props.makeClient(sessionCookie), [props, sessionCookie]);
  const isAuthenticated = Boolean(sessionCookie);

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

    setHomeSnapshot(next);
    setBusy(false);
    setStatusLine(next.backend === "connected" ? successLine : "Backend unreachable or unauthorized");
    return next;
  };

  const refresh = async () => refreshWithClient(client);

  const completeLocalLogout = (successLine: string) => {
    clearSessionCookie();
    setSessionCookie(undefined);
    setHomeSnapshot(createInitialHomeSnapshot());
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
    setSessionCookie(nextSessionCookie);
    setHomeSnapshot(createPendingAuthenticatedHomeSnapshot());
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
        const apiError = error as ApiClientError;
        if (apiError?.name === "ApiClientError" && (apiError.status === 401 || apiError.status === 403)) {
          setStatusLine("Playback control needs a fresh Spotify re-link. Press [l].");
          return;
        }

        setStatusLine(`${label} failed: ${toMessage(error)}`);
      }
    })();
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
        setStatusLine("");
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

  return <AuthenticatedHome snapshot={homeSnapshot} width={stdoutWidth} busy={busy} statusLine={statusLine} linkFlow={linkFlow} />;
}

export async function runTerminalApp(deps: AppDeps): Promise<void> {
  const instance = render(<App {...deps} />);

  await new Promise<void>((resolve) => {
    instance.waitUntilExit().then(resolve);
  });
}
