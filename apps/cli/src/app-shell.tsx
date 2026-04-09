import { Box, Text } from "ink";
import React from "react";
import type { HomeSnapshot } from "./home-state";
import {
  appPages,
  buildHomeSections,
  buildLibrarySections,
  buildPlaylistsSections,
  buildSearchSections,
  flattenSections,
  getPageLabel,
  type AppFocusRegion,
  type AppPage,
  type ContentSection,
  type ShellBrowseState
} from "./app-shell-state";

type AppShellProps = {
  page: AppPage;
  focusRegion: AppFocusRegion;
  contentIndex: number;
  player: HomeSnapshot;
  browse: ShellBrowseState;
  width: number;
  height: number;
  busy: boolean;
  statusLine: string;
  searchEditing: boolean;
  linkPending: boolean;
};

function clipLine(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatProgress(progressMs: number, durationMs: number, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (durationMs <= 0) {
    return "─".repeat(width);
  }

  const ratio = Math.max(0, Math.min(1, progressMs / durationMs));
  const filled = Math.max(1, Math.round(ratio * width));
  return `${"█".repeat(filled)}${"─".repeat(Math.max(0, width - filled))}`;
}

function describeDevice(player: HomeSnapshot): string {
  const suffix = player.deviceType ? ` · ${player.deviceType.toLowerCase()}` : "";
  if (player.deviceStatus === "active" && player.deviceName) {
    return `${player.deviceName}${suffix}`;
  }

  if (player.deviceStatus === "available" && player.deviceName) {
    return `${player.deviceName}${suffix} ready`;
  }

  if (player.deviceStatus === "restricted" && player.deviceName) {
    return `${player.deviceName}${suffix} restricted`;
  }

  return "No active device";
}

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

function getSections(page: AppPage, browse: ShellBrowseState): ContentSection[] {
  return page === "home"
    ? buildHomeSections(browse)
    : page === "search"
      ? buildSearchSections(browse)
      : page === "library"
        ? buildLibrarySections(browse)
        : buildPlaylistsSections(browse);
}

function PageBody({
  page,
  browse,
  contentIndex,
  focusRegion,
  width,
  searchEditing,
  player,
  linkPending
}: {
  page: AppPage;
  browse: ShellBrowseState;
  contentIndex: number;
  focusRegion: AppFocusRegion;
  width: number;
  searchEditing: boolean;
  player: HomeSnapshot;
  linkPending: boolean;
}) {
  const sections = getSections(page, browse);
  const items = flattenSections(sections);
  let absoluteIndex = 0;
  const contentWidth = width - 4;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Text color="green" bold>
        {getPageLabel(page)}
      </Text>
      {page === "search" ? (
        <Box marginBottom={1} flexDirection="column">
          <Text color="white">{clipLine("Query", contentWidth)}</Text>
          <Text color={searchEditing ? "black" : "white"} backgroundColor={searchEditing ? "green" : undefined}>
            {clipLine(browse.searchQuery ? browse.searchQuery : "Press [enter] to type a search", contentWidth)}
          </Text>
          {browse.searchError ? <Text color="red">{clipLine(browse.searchError, contentWidth)}</Text> : null}
          {browse.searchBusy ? <Text color="yellow">{clipLine("Searching Spotify...", contentWidth)}</Text> : null}
        </Box>
      ) : null}
      {sections.length === 0 ? (
        <Text color="white">
          {clipLine(
            player.spotify !== "linked"
              ? linkPending
                ? "Finish Spotify link to unlock browsing."
                : "Link Spotify with [l] to populate Home, Search, Library and Playlists."
              : page === "search"
                ? "Press [/] to start a search."
                : "Nothing to show on this page yet.",
            contentWidth
          )}
        </Text>
      ) : (
        sections.map((section) => (
          <Box key={section.id} flexDirection="column" marginBottom={1}>
            <Text color="cyan">{section.title}</Text>
            {section.items.map((item) => {
              const selected = absoluteIndex === contentIndex;
              const row = clipLine(
                item.meta ? `${item.title} · ${item.subtitle} · ${item.meta}` : `${item.title} · ${item.subtitle}`,
                contentWidth
              );
              absoluteIndex += 1;
              return <React.Fragment key={item.id}>{renderRow(row, selected, focusRegion === "content")}</React.Fragment>;
            })}
          </Box>
        ))
      )}
      {page !== "search" ? null : items.length === 0 && !browse.searchBusy && browse.searchQuery ? (
        <Text color="white">{clipLine("No results for this query.", contentWidth)}</Text>
      ) : null}
    </Box>
  );
}

function BottomPlayer({
  player,
  width,
  statusLine,
  busy,
  page,
  focusRegion,
  linkPending
}: {
  player: HomeSnapshot;
  width: number;
  statusLine: string;
  busy: boolean;
  page: AppPage;
  focusRegion: AppFocusRegion;
  linkPending: boolean;
}) {
  const leftWidth = Math.floor(width * 0.35);
  const rightWidth = Math.floor(width * 0.25);
  const centerWidth = Math.max(20, width - leftWidth - rightWidth - 8);
  const playbackLabel =
    player.spotify !== "linked"
      ? linkPending
        ? "Spotify linking in progress"
        : "Spotify not linked"
      : player.playbackState === "idle"
        ? "No active playback"
        : `${player.trackName || "Unknown track"} · ${player.artistName}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width}>
      <Box justifyContent="space-between">
        <Text color="white">{clipLine(playbackLabel, leftWidth)}</Text>
        <Text color="white">{clipLine(`[${getPageLabel(page)}] ${focusRegion}`, centerWidth)}</Text>
        <Text color="white">{clipLine(describeDevice(player), rightWidth)}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="white">{clipLine(player.albumName || " ", leftWidth)}</Text>
        <Text color="white">
          {clipLine(
            `${formatDuration(player.progressMs)} ${formatProgress(player.progressMs, player.durationMs, Math.max(10, centerWidth - 16))} ${formatDuration(player.durationMs)}`,
            centerWidth
          )}
        </Text>
        <Text color="white">
          {clipLine(
            `shuf ${player.shuffleEnabled ? "on" : "off"} rep ${player.repeatMode} vol ${player.supportsVolume ? `${player.volumePercent}%` : "n/a"}`,
            rightWidth
          )}
        </Text>
      </Box>
      <Text color="white">
        {clipLine("[tab] focus  [↑↓] move  [enter] select/edit  [space] play  [,/.] prev/next  [s/t] shuffle/repeat  [-/=] volume", width - 4)}
      </Text>
      <Text color={busy ? "yellow" : player.error ? "red" : "cyan"}>{clipLine(busy ? "working..." : statusLine, width - 4)}</Text>
    </Box>
  );
}

export function AuthenticatedShell(props: AppShellProps) {
  const sidebarWidth = 18;
  const shellWidth = props.width;
  const bodyHeight = Math.max(8, props.height - 8);
  const contentWidth = shellWidth - sidebarWidth - 3;

  return (
    <Box flexDirection="column" width={shellWidth} height={props.height} paddingX={1}>
      <Box height={bodyHeight}>
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={sidebarWidth}>
          <Text color="green" bold>
            CLIPIFY
          </Text>
          <Text color="white">{clipLine(props.player.userName, sidebarWidth - 4)}</Text>
          <Box marginTop={1} flexDirection="column">
            {appPages.map((entry) => (
              <React.Fragment key={entry}>
                {renderRow(clipLine(getPageLabel(entry), sidebarWidth - 4), props.page === entry, props.focusRegion === "sidebar")}
              </React.Fragment>
            ))}
          </Box>
        </Box>
        <Box marginLeft={1} flexDirection="column" width={contentWidth}>
          <PageBody
            page={props.page}
            browse={props.browse}
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
    </Box>
  );
}
