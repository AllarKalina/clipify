import { Box, Text } from "ink";
import React from "react";
import { describePlayerDevice } from "./device-picker-state";
import type { HomeSnapshot } from "./home-state";
import { getPageLabel, type AppFocusRegion, type AppPage } from "./app-shell-state";
import { clipLine, formatDuration, formatProgress } from "./app-shell-utils";

type BottomPlayerProps = {
  player: HomeSnapshot;
  width: number;
  statusLine: string;
  busy: boolean;
  page: AppPage;
  focusRegion: AppFocusRegion;
  linkPending: boolean;
};

export function BottomPlayer({
  player,
  width,
  statusLine,
  busy,
  page,
  focusRegion,
  linkPending
}: BottomPlayerProps) {
  const leftWidth = Math.floor(width * 0.35);
  const rightWidth = Math.floor(width * 0.25);
  const centerWidth = Math.max(20, width - leftWidth - rightWidth - 8);
  const playbackLabel =
    player.spotify !== "linked"
      ? linkPending
        ? "Spotify linking in progress"
        : "Spotify not linked"
      : player.playbackState === "idle"
        ? "No active playback"
        : `${player.trackName || "Unknown track"} · ${player.artistName}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width}>
      <Box justifyContent="space-between">
        <Text color="white">{clipLine(playbackLabel, leftWidth)}</Text>
        <Text color="white">{clipLine(`[${getPageLabel(page)}] ${focusRegion}`, centerWidth)}</Text>
        <Text color="white">{clipLine(describePlayerDevice(player), rightWidth)}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="white">{clipLine(player.albumName || " ", leftWidth)}</Text>
        <Text color="white">
          {clipLine(
            `${formatDuration(player.progressMs)} ${formatProgress(player.progressMs, player.durationMs, Math.max(10, centerWidth - 16))} ${formatDuration(player.durationMs)}`,
            centerWidth
          )}
        </Text>
        <Text color="white">
          {clipLine(
            `shuf ${player.shuffleEnabled ? "on" : "off"} rep ${player.repeatMode} vol ${player.supportsVolume ? `${player.volumePercent}%` : "n/a"}`,
            rightWidth
          )}
        </Text>
      </Box>
      <Text color="white">
        {clipLine("[tab] focus  [↑↓] move  [enter] select/edit  [space] play  [,/.] prev/next  [s/t] shuffle/repeat  [-/=] volume", width - 4)}
      </Text>
      <Text color="white">{clipLine("[d] devices  [r] refresh  [l] link  [o] logout  [q] quit", width - 4)}</Text>
      <Text color={busy ? "yellow" : player.error ? "red" : "cyan"}>{clipLine(busy ? "working..." : statusLine, width - 4)}</Text>
    </Box>
  );
}
