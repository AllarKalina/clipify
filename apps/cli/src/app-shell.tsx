import type { SpotifyDeviceSummary } from "@clipify/api-client";
import { Box } from "ink";
import React from "react";
import type { ContentSection, AppFocusRegion, AppPage, ShellBrowseState } from "./app-shell-state";
import { AppPageBody } from "./app-page-body";
import { AppSidebar } from "./app-sidebar";
import { BottomPlayer } from "./bottom-player";
import { DevicePickerOverlay } from "./device-picker-overlay";
import type { HomeSnapshot } from "./home-state";

type AppShellProps = {
  page: AppPage;
  focusRegion: AppFocusRegion;
  contentIndex: number;
  player: HomeSnapshot;
  browse: ShellBrowseState;
  sections: ContentSection[];
  width: number;
  height: number;
  busy: boolean;
  statusLine: string;
  searchEditing: boolean;
  linkPending: boolean;
  devicePickerOpen: boolean;
  devicePickerDevices: SpotifyDeviceSummary[];
  devicePickerIndex: number;
  devicePickerLoading: boolean;
};

export function AuthenticatedShell(props: AppShellProps) {
  const sidebarWidth = 18;
  const shellWidth = props.width;
  const bodyHeight = Math.max(8, props.height - 8);
  const contentWidth = shellWidth - sidebarWidth - 3;

  return (
    <Box flexDirection="column" width={shellWidth} height={props.height} paddingX={1}>
      <Box height={bodyHeight}>
        <AppSidebar
          width={sidebarWidth}
          page={props.page}
          focusRegion={props.focusRegion}
          userName={props.player.userName}
        />
        <Box marginLeft={1} flexDirection="column" width={contentWidth}>
          <AppPageBody
            page={props.page}
            browse={props.browse}
            sections={props.sections}
            contentIndex={props.contentIndex}
            focusRegion={props.focusRegion}
            width={contentWidth}
            searchEditing={props.searchEditing}
            player={props.player}
            linkPending={props.linkPending}
          />
        </Box>
      </Box>
      <Box marginTop={1}>
        <BottomPlayer
          player={props.player}
          width={shellWidth - 2}
          statusLine={props.statusLine}
          busy={props.busy}
          page={props.page}
          focusRegion={props.focusRegion}
          linkPending={props.linkPending}
        />
      </Box>
      {props.devicePickerOpen ? (
        <DevicePickerOverlay
          width={shellWidth}
          height={props.height}
          devices={props.devicePickerDevices}
          selectedIndex={props.devicePickerIndex}
          loading={props.devicePickerLoading}
        />
      ) : null}
    </Box>
  );
}
