import { Box, Text } from "ink";
import React from "react";
import { clipLine } from "./app-shell-utils";
import { getTrackSortLabel, TRACK_SORT_MODES, type TrackSortMode } from "./app-shell-state";

type SortPickerOverlayProps = {
  width: number;
  height: number;
  selectedIndex: number;
  currentMode: TrackSortMode;
};

function getSortDescription(mode: TrackSortMode): string {
  return mode === "original"
    ? "playlist order"
    : mode === "added"
      ? "newest added"
      : mode === "title"
        ? "track title"
        : "artist name";
}

export function SortPickerOverlay({ width, height, selectedIndex, currentMode }: SortPickerOverlayProps) {
  const panelWidth = Math.min(58, Math.max(38, width - 8));
  const contentWidth = panelWidth - 4;

  return (
    <Box position="absolute" width={width} height={height} justifyContent="center" alignItems="center">
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} width={panelWidth}>
        <Text color="yellow" bold>
          Sort Tracks
        </Text>
        <Text color="white">{clipLine("[↑↓] choose  [enter] apply  [esc] close", contentWidth)}</Text>
        {TRACK_SORT_MODES.map((mode, index) => {
          const selected = selectedIndex === index;
          const active = currentMode === mode;
          const marker = active ? "●" : " ";
          const label = `${marker} ${getTrackSortLabel(mode).padEnd(8, " ")} ${getSortDescription(mode)}`;

          return (
            <Text
              key={mode}
              color={selected ? "black" : active ? "cyan" : "white"}
              backgroundColor={selected ? "green" : undefined}
              bold={selected || active}
            >
              {clipLine(label, contentWidth)}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
