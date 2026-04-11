import { Box, Text } from "ink";
import React from "react";
import type { AppFocusRegion, ShellBrowseState } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";

type AppTopBarProps = {
  browse: ShellBrowseState;
  focusRegion: AppFocusRegion;
  contentIndex: number;
  height: number;
  width: number;
  player: HomeSnapshot;
};

export function getSearchPromptLine(player: HomeSnapshot) {
  if (player.spotify === "relink-required") {
    return "Spotify permissions changed";
  }

  return "What do you want to play?";
}

export function getSearchInputLine(browse: ShellBrowseState, player: HomeSnapshot) {
  if (browse.searchQuery) {
    return browse.searchQuery;
  }

  return player.spotify === "relink-required"
    ? "Press [l] to re-link Spotify before searching"
    : "Type [/] or press [enter] to search";
}

export function getTopBarHeight(browse: ShellBrowseState) {
  return 4 + (browse.searchError ? 1 : 0) + (browse.searchBusy ? 1 : 0);
}

export function AppTopBar({ browse, focusRegion, contentIndex, height, width, player }: AppTopBarProps) {
  const contentWidth = width - 4;
  const searchSelected = contentIndex === 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width} height={height} minHeight={height} flexShrink={0} marginBottom={1}>
      <Text color="cyan">{clipLine(getSearchPromptLine(player), contentWidth)}</Text>
      <Text color={searchSelected && focusRegion === "content" ? "black" : "white"} backgroundColor={searchSelected && focusRegion === "content" ? "green" : undefined}>
        {clipLine(getSearchInputLine(browse, player), contentWidth)}
      </Text>
      {browse.searchError ? <Text color="red">{clipLine(browse.searchError, contentWidth)}</Text> : null}
      {browse.searchBusy ? <Text color="yellow">{clipLine("Searching Spotify...", contentWidth)}</Text> : null}
    </Box>
  );
}
