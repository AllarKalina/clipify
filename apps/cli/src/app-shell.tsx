import type { SpotifyDeviceSummary } from "@clipify/api-client";
import { Box } from "ink";
import React from "react";
import type { ContentItem, ContentSection, AppFocusRegion, MainView, ShellBrowseState } from "./app-shell-state";
import { AppPageBody } from "./app-page-body";
import { AppSidebar } from "./app-sidebar";
import { AppTopBar, getTopBarHeight } from "./app-top-bar";
import { BottomPlayer } from "./bottom-player";
import { DevicePickerOverlay } from "./device-picker-overlay";
import type { HomeSnapshot } from "./home-state";

type AppShellProps = {
  mainView: MainView;
  focusRegion: AppFocusRegion;
  sidebarItems: ContentItem[];
  sidebarIndex: number;
  contentIndex: number;
  player: HomeSnapshot;
  browse: ShellBrowseState;
  sections: ContentSection[];
  width: number;
  height: number;
  busy: boolean;
  statusLine: string;
  searchEditing: boolean;
  controlPrefixActive: boolean;
  linkPending: boolean;
  devicePickerOpen: boolean;
  devicePickerDevices: SpotifyDeviceSummary[];
  devicePickerIndex: number;
  devicePickerLoading: boolean;
};

export function AuthenticatedShell(props: AppShellProps) {
  const sidebarWidth = Math.max(28, Math.floor(props.width * 0.24));
  const shellWidth = props.width;
  const topBarHeight = getTopBarHeight(props.browse);
  const mainRowHeight = Math.max(8, props.height - 8);
  const bodyHeight = Math.max(4, mainRowHeight - topBarHeight);
  const contentWidth = shellWidth - sidebarWidth - 3;

  return (
    <Box flexDirection="column" width={shellWidth} height={props.height} paddingX={1}>
      <Box height={mainRowHeight}>
        <AppSidebar
          width={sidebarWidth}
          height={mainRowHeight}
          focusRegion={props.focusRegion}
          userName={props.player.userName}
          items={props.sidebarItems}
          selectedIndex={props.sidebarIndex}
        />
        <Box marginLeft={1} flexDirection="column" width={contentWidth} height={mainRowHeight}>
          <AppTopBar
            browse={props.browse}
            focusRegion={props.focusRegion}
            contentIndex={props.contentIndex}
            height={topBarHeight}
            width={contentWidth}
            player={props.player}
            searchEditing={props.searchEditing}
          />
          <AppPageBody
            mainView={props.mainView}
            browse={props.browse}
            sections={props.sections}
            contentIndex={props.contentIndex}
            focusRegion={props.focusRegion}
            width={contentWidth}
            height={bodyHeight}
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
          mainView={props.mainView}
          focusRegion={props.focusRegion}
          linkPending={props.linkPending}
          controlPrefixActive={props.controlPrefixActive}
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
