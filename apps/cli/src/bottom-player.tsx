import { Box, Text } from "ink";
import React from "react";
import { describePlayerDevice, getPlayerDeviceHint } from "./device-picker-state";
import type { HomeSnapshot } from "./home-state";
import { getMainViewLabel } from "./app-shell-navigation";
import type { AppFocusRegion, MainView } from "./app-shell-types";
import { clipLine, formatDuration, formatProgress } from "./app-shell-utils";

type BottomPlayerProps = {
  player: HomeSnapshot;
  width: number;
  statusLine: string;
  busy: boolean;
  mainView: MainView;
  focusRegion: AppFocusRegion;
  linkPending: boolean;
  controlPrefixActive: boolean;
};

export function BottomPlayer({
  player,
  width,
  statusLine,
  busy,
  mainView,
  focusRegion,
  linkPending,
  controlPrefixActive
}: BottomPlayerProps) {
  const leftWidth = Math.floor(width * 0.35);
  const rightWidth = Math.floor(width * 0.25);
  const centerWidth = Math.max(20, width - leftWidth - rightWidth - 8);
  const playbackLabel =
    player.spotify !== "linked"
      ? linkPending
        ? "Spotify linking in progress"
        : player.spotify === "relink-required"
          ? "Spotify re-link required"
        : "Spotify not linked"
      : player.playbackState === "idle"
        ? "No active playback"
        : `${player.trackName || "Unknown track"} · ${player.artistName}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width}>
      <Box justifyContent="space-between">
        <Text color="white">{clipLine(playbackLabel, leftWidth)}</Text>
        <Text color="white">{clipLine(`[${getMainViewLabel(mainView)}] ${focusRegion}`, centerWidth)}</Text>
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
        {clipLine("[tab] focus  [↑↓] move  [←→] lateral  [enter] select/search  [/] search", width - 4)}
      </Text>
      <Text color={controlPrefixActive ? "green" : "white"} bold={controlPrefixActive}>
        {clipLine(
          controlPrefixActive
            ? "cmd+s active: [space] play  [,/.] prev/next  [s/t] modes  [a] sort  [-/=] volume  [d/r/l/o/q/h] app"
            : "[cmd+s] controls: play, prev/next, modes, sort, devices, refresh, link, logout, quit, home",
          width - 4
        )}
      </Text>
      <Text color="white">{clipLine(getPlayerDeviceHint(player), width - 4)}</Text>
      <Text color={busy ? "yellow" : player.error ? "red" : "cyan"}>{clipLine(busy ? "working..." : statusLine, width - 4)}</Text>
    </Box>
  );
}
