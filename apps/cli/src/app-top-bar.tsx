import { Box, Text } from "ink";
import React from "react";
import type { AppFocusRegion, ShellBrowseState } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

type AppTopBarProps = {
  browse: ShellBrowseState;
  focusRegion: AppFocusRegion;
  contentIndex: number;
  height: number;
  width: number;
  player: HomeSnapshot;
  searchEditing: boolean;
};

export function getSearchPromptLine(player: HomeSnapshot) {
  if (player.spotify === "relink-required") {
    return iconLabel(NERD_ICONS.search, "Re-link Spotify to search");
  }

  return iconLabel(NERD_ICONS.search, "Search Spotify");
}

export function getSearchInputLine(browse: ShellBrowseState, player: HomeSnapshot, searchEditing = false) {
  if (player.spotify === "relink-required") {
    return iconLabel(NERD_ICONS.search, "Re-link Spotify to search");
  }

  if (browse.searchQuery) {
    return iconLabel(NERD_ICONS.search, browse.searchQuery);
  }

  return searchEditing ? iconLabel(NERD_ICONS.search, "") : iconLabel(NERD_ICONS.search, "Search Spotify");
}

export function getTopBarHeight(browse: ShellBrowseState) {
  return 3 + (browse.searchError ? 1 : 0) + (browse.searchBusy ? 1 : 0);
}

export function AppTopBar({ browse, focusRegion, contentIndex, height, width, player, searchEditing }: AppTopBarProps) {
  const contentWidth = width - 4;
  const searchSelected = contentIndex === 0;
  const searchActive = searchSelected && focusRegion === "content";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width} height={height} minHeight={height} flexShrink={0}>
      <Text color={searchActive ? "black" : searchEditing ? "cyan" : "white"} backgroundColor={searchActive ? "green" : undefined} bold={searchEditing}>
        {clipLine(getSearchInputLine(browse, player, searchEditing), contentWidth)}
      </Text>
      {browse.searchError ? <Text color="red">{clipLine(browse.searchError, contentWidth)}</Text> : null}
      {browse.searchBusy ? <Text color="yellow">{clipLine(iconLabel(NERD_ICONS.search, `Searching ${browse.submittedSearchQuery}...`), contentWidth)}</Text> : null}
    </Box>
  );
}
