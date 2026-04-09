import { Box, Text } from "ink";
import React from "react";
import type { HomeSnapshot } from "./home-state";

type LinkFlow = {
  authorizeUrl: string;
};

type HomeProps = {
  snapshot: HomeSnapshot;
  width: number;
  busy: boolean;
  statusLine: string;
  linkFlow: LinkFlow | null;
};

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatProgress(progressMs: number, durationMs: number): string {
  const width = 20;
  if (durationMs <= 0) {
    return `${"─".repeat(width)}  ${formatDuration(progressMs)} / ${formatDuration(durationMs)}`;
  }

  const ratio = Math.max(0, Math.min(1, progressMs / durationMs));
  const filled = Math.max(1, Math.round(ratio * width));
  return `${"█".repeat(filled)}${"─".repeat(width - filled)}  ${formatDuration(progressMs)} / ${formatDuration(durationMs)}`;
}

function clipLine(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function statusColor(state: HomeSnapshot["spotify"] | HomeSnapshot["backend"]): "green" | "yellow" | "red" {
  if (state === "connected" || state === "linked") {
    return "green";
  }

  if (state === "not-linked") {
    return "yellow";
  }

  return "red";
}

function formatRepeatMode(mode: HomeSnapshot["repeatMode"]): string {
  return mode === "context" ? "all" : mode;
}

function describeDevice(snapshot: HomeSnapshot): string {
  const suffix = snapshot.deviceType ? ` (${snapshot.deviceType.toLowerCase()})` : "";
  if (snapshot.deviceStatus === "active" && snapshot.deviceName) {
    return `${snapshot.deviceName}${suffix}`;
  }

  if (snapshot.deviceStatus === "available" && snapshot.deviceName) {
    return `${snapshot.deviceName}${suffix} ready`;
  }

  if (snapshot.deviceStatus === "restricted" && snapshot.deviceName) {
    return `${snapshot.deviceName}${suffix} restricted`;
  }

  return "No active device";
}

function HeroPanel({ snapshot, width }: { snapshot: HomeSnapshot; width: number }) {
  const contentWidth = width - 4;

  if (snapshot.spotify !== "linked") {
    const title = snapshot.spotify === "unknown" ? "Loading home" : "Spotify not linked";
    const body =
      snapshot.spotify === "unknown"
        ? "Restoring your session and fetching Spotify context."
        : "Connect Spotify to unlock the home cockpit.";
    const hint = snapshot.spotify === "unknown" ? "Keep this terminal open." : "Press [l] to start browser auth.";

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text color="yellow" bold>
          {title}
        </Text>
        <Text color="white">{clipLine(body, contentWidth)}</Text>
        <Text color="white">{clipLine(hint, contentWidth)}</Text>
      </Box>
    );
  }

  if (snapshot.playbackState === "idle") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          Now playing
        </Text>
        <Text color="white">{clipLine("No active playback right now.", contentWidth)}</Text>
        <Text color="white">
          {clipLine(
            snapshot.deviceStatus === "available"
              ? `Device ready: ${describeDevice(snapshot)}. Start playback in Spotify to attach here.`
              : "Start something in Spotify, then press [r] to refresh.",
            contentWidth
          )}
        </Text>
        <Text color="white">{clipLine("[space] play/pause  [,] previous  [.] next", contentWidth)}</Text>
        <Text color="white">{clipLine("[s] shuffle  [t] repeat  [-/=] volume", contentWidth)}</Text>
      </Box>
    );
  }

  const playbackTone = snapshot.playbackState === "playing" ? "green" : "yellow";
  const playbackLabel = snapshot.playbackState === "playing" ? "playing" : "paused";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={playbackTone} paddingX={1}>
      <Text color={playbackTone} bold>
        Now playing · {playbackLabel}
      </Text>
      <Text color="green" bold>
        {clipLine(snapshot.trackName || "Unknown track", contentWidth)}
      </Text>
      <Text color="white">{clipLine(`${snapshot.artistName} · ${snapshot.albumName}`, contentWidth)}</Text>
      <Text color="white">{clipLine(formatProgress(snapshot.progressMs, snapshot.durationMs), contentWidth)}</Text>
      <Text color="white">
        {clipLine(
          `shuffle ${snapshot.shuffleEnabled ? "on" : "off"}  repeat ${formatRepeatMode(snapshot.repeatMode)}  volume ${snapshot.volumePercent}%`,
          contentWidth
        )}
      </Text>
      <Text color="white">{clipLine("[space] play/pause  [,] previous  [.] next", contentWidth)}</Text>
      <Text color="white">{clipLine("[s] shuffle  [t] repeat  [-/=] volume", contentWidth)}</Text>
    </Box>
  );
}

function QueuePanel({ snapshot, width }: { snapshot: HomeSnapshot; width: number }) {
  const contentWidth = width - 4;
  const items = snapshot.queue.slice(0, 4);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Text color="cyan" bold>
        Up next
      </Text>
      {snapshot.queueStatus === "relink-required" ? (
        <>
          <Text color="white">{clipLine("Queue needs a fresh Spotify re-link.", contentWidth)}</Text>
          <Text color="white">{clipLine("Press [l] to refresh scopes.", contentWidth)}</Text>
        </>
      ) : snapshot.queueStatus === "no-device" ? (
        <Text color="white">{clipLine("Queue appears when Spotify has an active device.", contentWidth)}</Text>
      ) : snapshot.queueStatus === "unavailable" ? (
        <Text color="white">{clipLine("Queue is temporarily unavailable.", contentWidth)}</Text>
      ) : items.length === 0 ? (
        <Text color="white">{clipLine("Nothing queued after the current track.", contentWidth)}</Text>
      ) : (
        items.map((item, index) => (
          <Text key={`queue-${index}`} color="white">
            {clipLine(`${index + 1}. ${item.trackName} · ${item.artistName}`, contentWidth)}
          </Text>
        ))
      )}
    </Box>
  );
}

function AccountPanel({ snapshot, width }: { snapshot: HomeSnapshot; width: number }) {
  const contentWidth = width - 4;
  const deviceLabel = describeDevice(snapshot);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Text color="cyan" bold>
        Player
      </Text>
      <Text color="white">{clipLine(snapshot.userName, contentWidth)}</Text>
      <Text color="white">{clipLine(snapshot.userEmail, contentWidth)}</Text>
      <Text color="white">{clipLine(`spotify: ${snapshot.spotifyDisplayName}`, contentWidth)}</Text>
      <Text color="white">{clipLine(`device: ${deviceLabel}`, contentWidth)}</Text>
      <Text color="white">{clipLine(`shuffle: ${snapshot.shuffleEnabled ? "on" : "off"}  repeat: ${formatRepeatMode(snapshot.repeatMode)}`, contentWidth)}</Text>
      <Text color="white">{clipLine(`volume: ${snapshot.supportsVolume ? `${snapshot.volumePercent}%` : "not available"}`, contentWidth)}</Text>
    </Box>
  );
}

export function AuthenticatedHome({ snapshot, width, busy, statusLine, linkFlow }: HomeProps) {
  const panelWidth = Math.min(Math.max(width - 4, 68), 96);
  const twoColumn = panelWidth >= 84;
  const secondaryWidth = twoColumn ? Math.floor((panelWidth - 1) / 2) : panelWidth;

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color="green" bold>
          CLIPIFY HOME
        </Text>
        <Text color={statusColor(snapshot.spotify)}>
          spotify {snapshot.spotify}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={panelWidth}>
        <Text color="white">
          {clipLine(`user ${snapshot.userName}  ·  backend ${snapshot.backend}`, panelWidth - 4)}
        </Text>
        <Text color="white">
          {clipLine(
            snapshot.deviceStatus === "none" ? "device waiting for playback context" : `device ${describeDevice(snapshot)}`,
            panelWidth - 4
          )}
        </Text>
      </Box>
      <Box marginTop={1} width={panelWidth}>
        <HeroPanel snapshot={snapshot} width={panelWidth} />
      </Box>
      {linkFlow ? (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={panelWidth}>
          <Text color="green" bold>
            Linking Spotify
          </Text>
          <Text color="white">{clipLine("Open this URL and approve access:", panelWidth - 4)}</Text>
          <Text color="white">{clipLine(linkFlow.authorizeUrl, panelWidth - 4)}</Text>
        </Box>
      ) : null}
      {twoColumn ? (
        <Box marginTop={1} gap={1}>
          <QueuePanel snapshot={snapshot} width={secondaryWidth} />
          <AccountPanel snapshot={snapshot} width={secondaryWidth} />
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <QueuePanel snapshot={snapshot} width={secondaryWidth} />
          <Box marginTop={1}>
            <AccountPanel snapshot={snapshot} width={secondaryWidth} />
          </Box>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column" width={panelWidth}>
        <Text color="white">[space] play/pause  [,] previous  [.] next  [s] shuffle  [t] repeat  [-/=] volume  [r] refresh</Text>
        <Text color="white">[l] link  [o] logout  [q] quit</Text>
        <Text color={busy ? "yellow" : snapshot.error ? "red" : "cyan"}>{busy ? "working..." : statusLine}</Text>
      </Box>
    </Box>
  );
}
