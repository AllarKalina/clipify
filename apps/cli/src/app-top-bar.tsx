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

function getSearchLabel(browse: ShellBrowseState, player: HomeSnapshot, searchEditing = false) {
  if (player.spotify === "relink-required") {
    return "Re-link Spotify to search";
  }

  if (browse.searchQuery) {
    return browse.searchQuery;
  }

  return searchEditing ? "" : "Search Spotify";
}

export function getSearchInputLine(browse: ShellBrowseState, player: HomeSnapshot, searchEditing = false) {
  return iconLabel(NERD_ICONS.search, getSearchLabel(browse, player, searchEditing));
}

export function clipSearchInputLabel(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value;
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

export function getTopBarHeight(browse: ShellBrowseState) {
  return 3 + (browse.searchError ? 1 : 0) + (browse.searchBusy ? 1 : 0);
}

export function AppTopBar({ browse, focusRegion, contentIndex, height, width, player, searchEditing }: AppTopBarProps) {
  const contentWidth = width - 4;
  const searchSelected = contentIndex === 0;
  const searchActive = searchSelected && focusRegion === "content";
  const showsPlaceholder = !browse.searchQuery && player.spotify !== "relink-required";
  const searchLabel = getSearchLabel(browse, player, searchEditing) || (showsPlaceholder ? "Search Spotify" : "");
  const cursor = searchActive ? (searchEditing ? "▌" : "▏") : "";
  const inputWidth = Math.max(1, contentWidth - 2 - cursor.length);
  const clippedSearchLabel = clipSearchInputLabel(searchLabel, inputWidth);
  const cursorOverPlaceholder = searchActive && showsPlaceholder && clippedSearchLabel.length > 0;
  const placeholderCursor = cursorOverPlaceholder ? clippedSearchLabel.slice(0, 1) : "";
  const placeholderTail = cursorOverPlaceholder ? clippedSearchLabel.slice(1) : clippedSearchLabel;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={searchActive ? "green" : "cyan"}
      paddingX={1}
      width={width}
      height={height}
      minHeight={height}
      flexShrink={0}
    >
      <Text>
        <Text color={searchActive ? "green" : "white"}>{`${NERD_ICONS.search} `}</Text>
        {cursorOverPlaceholder ? (
          <Text color="black" backgroundColor="green">
            {placeholderCursor}
          </Text>
        ) : null}
        <Text color={showsPlaceholder ? "gray" : "white"} bold={searchEditing && !showsPlaceholder}>
          {placeholderTail}
        </Text>
        {!cursorOverPlaceholder && cursor ? <Text color="green">{cursor}</Text> : null}
      </Text>
      {browse.searchError ? <Text color="red">{clipLine(browse.searchError, contentWidth)}</Text> : null}
      {browse.searchBusy ? <Text color="yellow">{clipLine(iconLabel(NERD_ICONS.search, `Searching ${browse.submittedSearchQuery}...`), contentWidth)}</Text> : null}
    </Box>
  );
}
