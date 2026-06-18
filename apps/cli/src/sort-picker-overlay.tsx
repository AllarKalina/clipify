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

function SortPickerLine({
  children,
  color,
  backgroundColor = "black",
  bold = false
}: {
  children: string;
  color: "black" | "cyan" | "green" | "white" | "yellow";
  backgroundColor?: "black" | "green";
  bold?: boolean;
}) {
  return (
    <Text color={color} backgroundColor={backgroundColor} bold={bold} wrap="truncate">
      {children}
    </Text>
  );
}

export function SortPickerOverlay({ width, height, selectedIndex, currentMode }: SortPickerOverlayProps) {
  if (width < 30 || height < 8) {
    return null;
  }

  const panelWidth = Math.min(58, Math.max(26, width - 4));
  const contentWidth = panelWidth - 2;

  return (
    <Box position="absolute" width={width} height={height} justifyContent="center" alignItems="center" overflow="hidden">
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" backgroundColor="black" width={panelWidth} overflow="hidden">
        <SortPickerLine color="yellow" bold>
          {clipLine(" Sort Tracks", contentWidth)}
        </SortPickerLine>
        <SortPickerLine color="white">{clipLine(" choose with arrows, enter applies", contentWidth)}</SortPickerLine>
        {TRACK_SORT_MODES.map((mode, index) => {
          const selected = selectedIndex === index;
          const active = currentMode === mode;
          const activeLabel = contentWidth >= 34 && active ? " (current)" : "";
          const label = ` ${getTrackSortLabel(mode).padEnd(8, " ")} ${getSortDescription(mode)}${activeLabel}`;

          return (
            <SortPickerLine
              key={mode}
              color={selected ? "black" : active ? "cyan" : "white"}
              backgroundColor={selected ? "green" : undefined}
              bold={selected || active}
            >
              {clipLine(label, contentWidth)}
            </SortPickerLine>
          );
        })}
      </Box>
    </Box>
  );
}
