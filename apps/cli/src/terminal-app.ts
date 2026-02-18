import type { ApiClient, ApiClientError } from "@clipify/api-client";
import { createInterface } from "node:readline/promises";
import { clearSessionCookie, saveSessionCookie } from "./config";

type AppDeps = {
  apiBaseUrl: string;
  initialSessionCookie?: string;
  openBrowser: boolean;
  makeClient: (sessionCookie?: string) => ApiClient;
};

type AppSnapshot = {
  backendReachable: boolean;
  userLabel: string;
  spotifyLabel: string;
  nowPlayingLabel: string;
  error?: string;
};

function maskCookie(cookie?: string): string {
  if (!cookie) {
    return "none";
  }

  if (cookie.length <= 10) {
    return "********";
  }

  return `${cookie.slice(0, 6)}...${cookie.slice(-4)}`;
}

function clearScreen(): void {
  process.stdout.write("\x1Bc");
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

function parseSpotifyCallbackUrl(redirectUrl: string): { code: string; state: string } {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    throw new Error("redirect URL must include both code and state query parameters");
  }

  return { code, state };
}

async function getSnapshot(client: ApiClient): Promise<AppSnapshot> {
  try {
    const me = await client.getMe();

    try {
      const current = await client.getSpotifyCurrentlyPlaying();

      if (!current.isPlaying) {
        return {
          backendReachable: true,
          userLabel: `${me.user.name} <${me.user.email}>`,
          spotifyLabel: "linked",
          nowPlayingLabel: "idle"
        };
      }

      return {
        backendReachable: true,
        userLabel: `${me.user.name} <${me.user.email}>`,
        spotifyLabel: "linked",
        nowPlayingLabel: `${current.trackName} - ${current.artistName} (${current.albumName})`
      };
    } catch (error) {
      const apiError = error as ApiClientError;
      if (apiError?.name === "ApiClientError" && apiError.status === 409) {
        return {
          backendReachable: true,
          userLabel: `${me.user.name} <${me.user.email}>`,
          spotifyLabel: "not linked",
          nowPlayingLabel: "n/a"
        };
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      backendReachable: false,
      userLabel: "unknown",
      spotifyLabel: "unknown",
      nowPlayingLabel: "unknown",
      error: message
    };
  }
}

function render(snapshot: AppSnapshot, apiBaseUrl: string, sessionCookie?: string): void {
  clearScreen();
  console.log("clipify terminal");
  console.log(`api: ${apiBaseUrl}`);
  console.log(`cookie: ${maskCookie(sessionCookie)}`);
  console.log("");

  if (!snapshot.backendReachable) {
    console.log("backend: offline or unauthorized");
    if (snapshot.error) {
      console.log(`error: ${snapshot.error}`);
    }
  } else {
    console.log("backend: connected");
    console.log(`user: ${snapshot.userLabel}`);
    console.log(`spotify: ${snapshot.spotifyLabel}`);
    console.log(`now playing: ${snapshot.nowPlayingLabel}`);
  }

  console.log("");
  console.log("Actions:");
  console.log("  [1] Refresh status");
  console.log("  [2] Link Spotify");
  console.log("  [3] Show now playing");
  console.log("  [4] Set session cookie");
  console.log("  [5] Clear session cookie");
  console.log("  [q] Quit");
}

async function pause(rl: ReturnType<typeof createInterface>, message = "Press Enter to continue"): Promise<void> {
  await rl.question(`${message}\n`);
}

export async function runTerminalApp(deps: AppDeps): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let sessionCookie = deps.initialSessionCookie;

  try {
    while (true) {
      const client = deps.makeClient(sessionCookie);
      const snapshot = await getSnapshot(client);
      render(snapshot, deps.apiBaseUrl, sessionCookie);

      const action = (await rl.question("\nChoose action: ")).trim().toLowerCase();

      if (action === "q") {
        return;
      }

      if (action === "1") {
        continue;
      }

      if (action === "2") {
        try {
          const result = await client.startSpotifyAuthorization();
          console.log(`\nauthorizeUrl=${result.authorizeUrl}`);

          if (deps.openBrowser) {
            const opened = openUrl(result.authorizeUrl);
            console.log(opened ? "browser=open" : "browser=failed-to-open");
          }

          const redirectUrl = (await rl.question("Paste callback URL: ")).trim();
          const parsed = parseSpotifyCallbackUrl(redirectUrl);
          const linked = await client.completeSpotifyAuthorization(parsed);
          console.log(`linked=${linked.linked} userId=${linked.userId}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`link failed: ${message}`);
        }

        await pause(rl);
        continue;
      }

      if (action === "3") {
        try {
          const current = await client.getSpotifyCurrentlyPlaying();
          if (!current.isPlaying) {
            console.log("\nnow playing: idle");
          } else {
            console.log(`\nnow playing: ${current.trackName} - ${current.artistName} (${current.albumName})`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`now-playing failed: ${message}`);
        }

        await pause(rl);
        continue;
      }

      if (action === "4") {
        const nextCookie = (await rl.question("Enter raw Cookie header value: ")).trim();
        if (!nextCookie) {
          console.log("cookie not changed");
          await pause(rl);
          continue;
        }

        sessionCookie = nextCookie;
        saveSessionCookie(nextCookie);
        console.log("cookie saved");
        await pause(rl);
        continue;
      }

      if (action === "5") {
        clearSessionCookie();
        sessionCookie = undefined;
        console.log("cookie cleared");
        await pause(rl);
        continue;
      }

      console.log("unknown action");
      await pause(rl);
    }
  } finally {
    rl.close();
  }
}
