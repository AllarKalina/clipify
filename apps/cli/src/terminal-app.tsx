import type { ApiClient, ApiClientError } from "@clipify/api-client";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import React, { useEffect, useMemo, useState } from "react";
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

type InputMode = "none" | "signup-name" | "signup-email" | "signup-password" | "login-email" | "login-password";
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

function buildSpotifyLogo(width: number, height: number): string[] {
  const rows: string[] = [];
  const xRadius = (width - 1) / 2;
  const yRadius = (height - 1) / 2;

  const inArc = (
    x: number,
    y: number,
    baseY: number,
    curve: number,
    tilt: number,
    thickness: number,
    minX: number,
    maxX: number
  ): boolean => {
    if (x < minX || x > maxX) {
      return false;
    }

    const curveY = baseY + curve * x * x + tilt * x;
    return Math.abs(y - curveY) <= thickness;
  };

  for (let y = 0; y < height; y += 1) {
    let row = "";
    const ny = (y - yRadius) / yRadius;

    for (let x = 0; x < width; x += 1) {
      const nx = (x - xRadius) / xRadius;
      const insideCircle = nx * nx + ny * ny <= 1;

      if (!insideCircle) {
        row += ".";
        continue;
      }

      const isWave =
        inArc(nx, ny, -0.40, 0.22, 0.06, 0.05, -0.72, 0.66) ||
        inArc(nx, ny, -0.20, 0.20, 0.05, 0.05, -0.66, 0.57) ||
        inArc(nx, ny, -0.01, 0.18, 0.04, 0.05, -0.58, 0.49);

      row += isWave ? "b" : "g";
    }

    rows.push(row);
  }

  return rows;
}

const spotifyHeroLogo = buildSpotifyLogo(55, 17);
const spotifyHeroWidth = spotifyHeroLogo[0]?.length ?? 39;
const unauthMenuWidth = 20;
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
  const content = selected ? `> ${label} <` : `  ${label}  `;
  return centerText(content, unauthMenuWidth);
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

function SpotifyHero() {
  return (
    <Box flexDirection="column" alignItems="center">
      {spotifyHeroLogo.map((line, lineIndex) => (
        <Text key={`spotify-logo-line-${lineIndex}`}>
          {Array.from(line).map((pixel, pixelIndex) => {
            if (pixel === "g") {
              return (
                <Text key={`spotify-logo-pixel-${lineIndex}-${pixelIndex}`} backgroundColor="green">
                  {" "}
                </Text>
              );
            }

            if (pixel === "b") {
              return (
                <Text key={`spotify-logo-pixel-${lineIndex}-${pixelIndex}`} backgroundColor="black">
                  {" "}
                </Text>
              );
            }

            return <Text key={`spotify-logo-pixel-${lineIndex}-${pixelIndex}`}>{" "}</Text>;
          })}
        </Text>
      ))}
      <Box width={spotifyHeroWidth} flexDirection="column" alignItems="center">
        <Text color="green" bold>
          C L I p i f y
        </Text>
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
  const [sessionCookie, setSessionCookie] = useState<string | undefined>(props.initialSessionCookie);
  const [snapshot, setSnapshot] = useState<Snapshot>(createInitialSnapshot);
  const [inputMode, setInputMode] = useState<InputMode>("none");
  const [inputValue, setInputValue] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
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
    setInputMode("none");
    setInputValue("");
    setPendingEmail("");
    setPendingName("");
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
    setInputMode("none");
    setInputValue("");
    setPendingEmail("");
    setPendingName("");
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

    if (inputMode !== "none") {
      if (key.return) {
        const value = inputValue.trim();

        if (inputMode === "login-email") {
          if (!value) {
            setStatusLine("Email is required");
            return;
          }

          setPendingEmail(value);
          setInputMode("login-password");
          setInputValue("");
          setStatusLine("Enter password");
          return;
        }

        if (inputMode === "signup-name") {
          if (!value) {
            setStatusLine("Name is required");
            return;
          }

          setPendingName(value);
          setInputMode("signup-email");
          setInputValue("");
          setStatusLine("Enter email");
          return;
        }

        if (inputMode === "signup-email") {
          if (!value) {
            setStatusLine("Email is required");
            return;
          }

          setPendingEmail(value);
          setInputMode("signup-password");
          setInputValue("");
          setStatusLine("Enter password");
          return;
        }

        if (inputMode === "signup-password") {
          if (!pendingName || !pendingEmail || !value) {
            setStatusLine("Name, email, and password are required");
            return;
          }

          setBusy(true);
          void (async () => {
            try {
              const result = await client.signUpWithEmailPassword({
                name: pendingName,
                email: pendingEmail,
                password: value
              });
              await completeAuthenticatedOnboarding(result.sessionCookie, "Sign up successful");
            } catch (error) {
              setStatusLine(`Sign up failed: ${toMessage(error)}`);
              setInputMode("none");
              setInputValue("");
              setPendingEmail("");
              setPendingName("");
            } finally {
              setBusy(false);
            }
          })();
          return;
        }

        if (inputMode === "login-password") {
          if (!pendingEmail || !value) {
            setStatusLine("Email and password are required");
            return;
          }

          setBusy(true);
          void (async () => {
            try {
              const result = await client.signInWithEmailPassword({
                email: pendingEmail,
                password: value
              });
              await completeAuthenticatedOnboarding(result.sessionCookie, "Login successful");
            } catch (error) {
              setStatusLine(`Login failed: ${toMessage(error)}`);
              setInputMode("none");
              setInputValue("");
              setPendingEmail("");
              setPendingName("");
            } finally {
              setBusy(false);
            }
          })();
          return;
        }

        setInputMode("none");
        setInputValue("");
        setPendingEmail("");
        setPendingName("");
        return;
      }

      if (key.escape) {
        setInputMode("none");
        setInputValue("");
        setPendingEmail("");
        setPendingName("");
        setStatusLine("Canceled");
        return;
      }

      if (key.backspace || key.delete) {
        setInputValue((current) => current.slice(0, -1));
        return;
      }

      if (input) {
        setInputValue((current) => current + input);
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

        setInputMode(unauthSelection === "signup" ? "signup-name" : "login-email");
        setInputValue("");
        setPendingEmail("");
        setPendingName("");
        setStatusLine(unauthSelection === "signup" ? "Enter name" : "Enter email");
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
        <SpotifyHero />
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Text color={unauthSelection === "signup" ? "green" : "gray"}>
            {formatUnauthMenuItem("Sign up", unauthSelection === "signup")}
          </Text>
          <Text color={unauthSelection === "login" ? "green" : "gray"}>
            {formatUnauthMenuItem("Login", unauthSelection === "login")}
          </Text>
          <Text color={unauthSelection === "exit" ? "green" : "gray"}>
            {formatUnauthMenuItem("Exit", unauthSelection === "exit")}
          </Text>
          <Text dimColor>Use up/down arrows and Enter</Text>
        </Box>
        {inputMode === "signup-name" ? <Text color="yellow">name&gt; {inputValue}</Text> : null}
        {inputMode === "signup-email" ? <Text color="yellow">email&gt; {inputValue}</Text> : null}
        {inputMode === "signup-password" ? <Text color="yellow">password&gt; {"*".repeat(inputValue.length)}</Text> : null}
        {inputMode === "login-email" ? <Text color="yellow">email&gt; {inputValue}</Text> : null}
        {inputMode === "login-password" ? <Text color="yellow">password&gt; {"*".repeat(inputValue.length)}</Text> : null}
        <Text color={busy ? "yellow" : "cyan"}>{busy ? "working..." : statusLine}</Text>
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
        {inputMode === "login-email" ? <Text color="yellow">email&gt; {inputValue}</Text> : null}
        {inputMode === "login-password" ? <Text color="yellow">password&gt; {"*".repeat(inputValue.length)}</Text> : null}
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
