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

export function getVisibleSidebarItems<T>(items: T[], selectedIndex: number, availableLines: number): T[] {
  if (availableLines <= 0 || items.length <= availableLines) {
    return items;
  }

  const clampedSelected = Math.max(0, Math.min(selectedIndex, items.length - 1));
  const windowStart = Math.max(0, Math.min(clampedSelected, items.length - availableLines));
  return items.slice(windowStart, windowStart + availableLines);
}

export function getSidebarListHeight(height: number): number {
  // Sidebar has title + list margin + profile margin + profile line.
  return Math.max(1, height - 6);
}

function normalizeProfileValue(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function buildProfileName(userName: string) {
  return normalizeProfileValue(userName, "unknown user");
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
  const listHeight = getSidebarListHeight(height);
  const profileName = buildProfileName(userName);
  const visibleItems = getVisibleSidebarItems(items, selectedIndex, listHeight);
  const visibleStartIndex = items.indexOf(visibleItems[0] ?? items[0]);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width} height={height} minHeight={height}>
      <Text color="green" bold>
        {iconLabel(NERD_ICONS.playlists, "Your Library")}
      </Text>
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
      <Box marginTop={1}>
        <Text color="cyan">{clipLine(iconLabel(NERD_ICONS.artist, profileName), width - 4)}</Text>
      </Box>
    </Box>
  );
}
