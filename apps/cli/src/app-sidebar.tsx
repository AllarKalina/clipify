import { Box, Text } from "ink";
import React from "react";
import type { ContentItem, AppFocusRegion } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

function getVisibleSidebarItems<T>(items: T[], selectedIndex: number, availableLines: number): T[] {
  if (availableLines <= 0 || items.length <= availableLines) {
    return items;
  }

  const clampedSelected = Math.max(0, Math.min(selectedIndex, items.length - 1));
  const windowStart = Math.max(0, Math.min(clampedSelected, items.length - availableLines));
  return items.slice(windowStart, windowStart + availableLines);
}

type AppSidebarProps = {
  width: number;
  height: number;
  focusRegion: AppFocusRegion;
  userName: string;
  items: ContentItem[];
  selectedIndex: number;
};

export function AppSidebar({ width, height, focusRegion, userName, items, selectedIndex }: AppSidebarProps) {
  const rowWidth = Math.max(1, width - 5);
  const listHeight = Math.max(1, height - 6);
  const visibleItems = getVisibleSidebarItems(items, selectedIndex, listHeight);
  const visibleStartIndex = items.indexOf(visibleItems[0] ?? items[0]);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width} height={height} minHeight={height}>
      <Text color="green" bold>
        {iconLabel(NERD_ICONS.playlists, "Your Library")}
      </Text>
      <Text color="white">{clipLine(userName, width - 4)}</Text>
      <Box marginTop={1} flexDirection="column" height={listHeight}>
        {items.length === 0 ? (
          <Text color="white">{clipLine("Library is loading...", width - 4)}</Text>
        ) : (
          visibleItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {renderRow(
                clipLine(item.meta ? `${item.title} · ${item.subtitle}` : item.title, rowWidth),
                selectedIndex === visibleStartIndex + index,
                focusRegion === "sidebar"
              )}
            </React.Fragment>
          ))
        )}
      </Box>
    </Box>
  );
}
