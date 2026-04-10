import { Box, Text } from "ink";
import React from "react";
import type { ContentItem, AppFocusRegion } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

type AppSidebarProps = {
  width: number;
  focusRegion: AppFocusRegion;
  userName: string;
  items: ContentItem[];
  selectedIndex: number;
};

export function AppSidebar({ width, focusRegion, userName, items, selectedIndex }: AppSidebarProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width}>
      <Text color="green" bold>
        Your Library
      </Text>
      <Text color="white">{clipLine(userName, width - 4)}</Text>
      <Text color="cyan">{clipLine("Liked songs + playlists", width - 4)}</Text>
      <Box marginTop={1} flexDirection="column">
        {items.length === 0 ? (
          <Text color="white">{clipLine("Library is loading...", width - 4)}</Text>
        ) : (
          items.map((item, index) => (
            <React.Fragment key={item.id}>
              {renderRow(
                clipLine(item.meta ? `${item.title} · ${item.subtitle}` : item.title, width - 4),
                selectedIndex === index,
                focusRegion === "sidebar"
              )}
            </React.Fragment>
          ))
        )}
      </Box>
    </Box>
  );
}
