import type { ApiClient, ApiClientError } from "@clipify/api-client";
import { Box, Text, render, useApp, useInput } from "ink";
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
  nowPlaying: string;
  error?: string;
};

type InputMode = "none" | "cookie";

type LinkFlow = {
  authorizeUrl: string;
  state: string;
};

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

async function computeSnapshot(client: ApiClient): Promise<Snapshot> {
  try {
    const me = await client.getMe();

    try {
      const current = await client.getSpotifyCurrentlyPlaying();
      const nowPlaying = current.isPlaying
        ? `${current.trackName} - ${current.artistName} (${current.albumName})`
        : "idle";

      return {
        backend: "connected",
        user: `${me.user.name} <${me.user.email}>`,
        spotify: "linked",
        nowPlaying
      };
    } catch (error) {
      const apiError = error as ApiClientError;
      if (apiError?.name === "ApiClientError" && apiError.status === 409) {
        return {
          backend: "connected",
          user: `${me.user.name} <${me.user.email}>`,
          spotify: "not-linked",
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
      nowPlaying: "unknown",
      error: toMessage(error)
    };
  }
}

function App(props: AppDeps) {
  const { exit } = useApp();
  const [sessionCookie, setSessionCookie] = useState<string | undefined>(props.initialSessionCookie);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    backend: "offline",
    user: "loading",
    spotify: "unknown",
    nowPlaying: "loading"
  });
  const [inputMode, setInputMode] = useState<InputMode>("none");
  const [inputValue, setInputValue] = useState("");
  const [linkFlow, setLinkFlow] = useState<LinkFlow | null>(null);
  const [statusLine, setStatusLine] = useState("Loading...");
  const [busy, setBusy] = useState(false);

  const client = useMemo(() => props.makeClient(sessionCookie), [props, sessionCookie]);

  const refresh = async () => {
    setBusy(true);
    const next = await computeSnapshot(client);
    setSnapshot(next);
    setBusy(false);
    setStatusLine(next.backend === "connected" ? "Refreshed" : "Backend unreachable or unauthorized");
  };

  useEffect(() => {
    void refresh();
  }, [client]);

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

        if (inputMode === "cookie") {
          if (!value) {
            setStatusLine("Cookie unchanged");
          } else {
            setSessionCookie(value);
            saveSessionCookie(value);
            setStatusLine("Cookie saved");
            void refresh();
          }
        }

        setInputMode("none");
        setInputValue("");
        return;
      }

      if (key.escape) {
        setInputMode("none");
        setInputValue("");
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

    if (input === "r") {
      void refresh();
      return;
    }

    if (input === "x") {
      clearSessionCookie();
      setSessionCookie(undefined);
      setStatusLine("Cookie cleared");
      void refresh();
      return;
    }

    if (input === "c") {
      setInputMode("cookie");
      setInputValue("");
      setStatusLine("Enter cookie, press Enter to save, Esc to cancel");
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
          const start = await client.startSpotifyAuthorization();
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
        } finally {
          setBusy(false);
        }
      })();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">clipify terminal app</Text>
      <Text dimColor>api: {props.apiBaseUrl}</Text>
      <Text dimColor>cookie: {maskCookie(sessionCookie)}</Text>
      <Box marginTop={1} flexDirection="column" borderStyle="round" padding={1}>
        <Text>backend: {snapshot.backend}</Text>
        <Text>user: {snapshot.user}</Text>
        <Text>spotify: {snapshot.spotify}</Text>
        <Text>now playing: {snapshot.nowPlaying}</Text>
        {snapshot.error ? <Text color="red">error: {snapshot.error}</Text> : null}
      </Box>

      {linkFlow ? (
        <Box marginTop={1} flexDirection="column" borderStyle="single" padding={1}>
          <Text>Spotify authorize URL:</Text>
          <Text>{linkFlow.authorizeUrl}</Text>
          <Text dimColor>Waiting for browser callback to backend...</Text>
        </Box>
      ) : null}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>keys: [r] refresh  [l] link spotify  [n] now playing  [c] set cookie  [x] clear cookie  [q] quit</Text>
        {inputMode === "cookie" ? <Text color="yellow">cookie&gt; {inputValue}</Text> : null}
        <Text color={busy ? "yellow" : "cyan"}>{busy ? "working..." : statusLine}</Text>
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
