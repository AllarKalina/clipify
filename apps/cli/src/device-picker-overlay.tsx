import type { SpotifyDeviceSummary } from "@clipify/api-client";
import { Box, Text } from "ink";
import React from "react";
import { describeAvailableDevice } from "./device-picker-state";
import { clipLine } from "./app-shell-utils";

type DevicePickerOverlayProps = {
  width: number;
  height: number;
  devices: SpotifyDeviceSummary[];
  selectedIndex: number;
  loading: boolean;
};

export function DevicePickerOverlay({
  width,
  height,
  devices,
  selectedIndex,
  loading
}: DevicePickerOverlayProps) {
  const panelWidth = Math.min(72, Math.max(44, width - 8));
  const panelHeight = Math.min(12, Math.max(8, height - 6));
  const contentWidth = panelWidth - 4;
  const visibleItems = devices.slice(0, Math.max(1, panelHeight - 4));

  return (
    <Box position="absolute" width={width} height={height} justifyContent="center" alignItems="center">
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} width={panelWidth}>
        <Text color="yellow" bold>
          Spotify Devices
        </Text>
        <Text color="white">{clipLine("[↑↓] move  [enter] transfer  [esc] close", contentWidth)}</Text>
        {loading ? <Text color="yellow">{clipLine("Loading available devices...", contentWidth)}</Text> : null}
        {!loading && visibleItems.length === 0 ? (
          <Text color="white">{clipLine("No Spotify devices available right now.", contentWidth)}</Text>
        ) : null}
        {!loading
          ? visibleItems.map((device, index) => (
              <Text
                key={device.id || `${device.name}-${index}`}
                color={selectedIndex === index && !device.isRestricted ? "black" : device.isRestricted ? "yellow" : "white"}
                backgroundColor={selectedIndex === index && !device.isRestricted ? "green" : undefined}
                bold={selectedIndex === index}
              >
                {clipLine(describeAvailableDevice(device), contentWidth)}
              </Text>
            ))
          : null}
      </Box>
    </Box>
  );
}
