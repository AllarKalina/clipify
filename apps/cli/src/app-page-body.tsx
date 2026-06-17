import { Box, Text } from "ink";
import React from "react";
import type { ContentItem, ContentSection, AppFocusRegion, MainView, ShellBrowseState } from "./app-shell-state";
import { getMainViewLabel } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

type TrackRowLayout = {
  indexLabel: string;
  metadata: string;
  marker: string;
  title: string;
};

export function formatTrackRow(item: ContentItem, absoluteIndex: number, width: number): TrackRowLayout {
  const indexLabel = absoluteIndex < 100 ? String(absoluteIndex).padStart(2, "0") : String(absoluteIndex);
  const marker = "▸";
  const prefixWidth = marker.length + 1 + indexLabel.length + 2;
  const availableWidth = Math.max(1, width - prefixWidth);
  const metadataText = item.subtitle;

  if (!metadataText || availableWidth < 32) {
    return {
      indexLabel,
      marker,
      title: clipLine(metadataText ? `${item.title} · ${metadataText}` : item.title, availableWidth),
      metadata: ""
    };
  }

  const metadataWidth = Math.min(metadataText.length, Math.max(16, Math.floor(availableWidth * 0.38)));
  const titleWidth = Math.max(1, availableWidth - metadataWidth - 3);

  return {
    indexLabel,
    marker,
    title: clipLine(item.title, titleWidth),
    metadata: clipLine(metadataText, metadataWidth)
  };
}

export function getListItemRenderKey(item: ContentItem, absoluteIndex: number): string {
  return `item-${absoluteIndex}-${item.id}`;
}

function renderRow(item: ContentItem, absoluteIndex: number, selected: boolean, activeRegion: boolean, width: number) {
  const layout = formatTrackRow(item, absoluteIndex, width);
  const activeSelected = selected && activeRegion;
  const markerColor = activeSelected ? "black" : selected ? "green" : "gray";
  const markerBackground = activeSelected ? "green" : undefined;
  const titleColor = activeSelected ? "green" : "white";
  const metadataColor = activeSelected ? "white" : "gray";

  return (
    <Text bold={selected}>
      <Text color={markerColor} backgroundColor={markerBackground}>
        {selected ? layout.marker : " "} {layout.indexLabel}
      </Text>
      <Text>  </Text>
      <Text color={titleColor}>{layout.title}</Text>
      {layout.metadata ? (
        <>
          <Text color="gray"> · </Text>
          <Text color={metadataColor}>{layout.metadata}</Text>
        </>
      ) : null}
    </Text>
  );
}

function renderTile(item: ContentItem, selected: boolean, activeRegion: boolean, width: number) {
  const lineOne = clipLine(item.title, width - 2);
  const supportingText = item.meta ? `${item.subtitle} · ${item.meta}` : item.subtitle || " ";
  const lineTwo = clipLine(supportingText, width - 2);

  return (
    <Box
      key={item.id}
      flexDirection="column"
      width={width}
      marginRight={1}
      paddingX={1}
      borderStyle="round"
      borderColor={selected && activeRegion ? "green" : "gray"}
    >
      <Text color={selected && activeRegion ? "green" : "white"} bold>
        {lineOne}
      </Text>
      <Text color="white">{lineTwo}</Text>
    </Box>
  );
}

type AppPageBodyProps = {
  mainView: MainView;
  browse: ShellBrowseState;
  sections: ContentSection[];
  contentIndex: number;
  focusRegion: AppFocusRegion;
  width: number;
  height: number;
  searchEditing: boolean;
  player: HomeSnapshot;
  linkPending: boolean;
};

type ListRenderLine =
  | { type: "section"; id: string; title: string }
  | { type: "item"; item: ContentItem; absoluteIndex: number };

type BuildVisibleListLinesOptions = {
  scrollMargin?: number;
  stickySectionIds?: string[];
};

export function formatPlaylistDetailHeader(playlistDetail: NonNullable<ShellBrowseState["playlistDetail"]>): string {
  return iconLabel(
    NERD_ICONS.playlists,
    `${playlistDetail.name} · ${playlistDetail.ownerName || "Spotify"} · ${playlistDetail.trackCount} tracks`
  );
}

function getPlaylistDetailMetadata(playlistDetail: NonNullable<ShellBrowseState["playlistDetail"]>): string {
  return `${playlistDetail.ownerName || "Spotify"} · ${playlistDetail.trackCount} tracks`;
}

export function shouldRenderMainViewLabel(mainView: MainView, playlistDetail: ShellBrowseState["playlistDetail"]): boolean {
  return mainView !== "home" && !playlistDetail;
}

export function getListScrollMargin(availableLines: number, requestedMargin = 2): number {
  if (availableLines <= 2) {
    return 0;
  }

  return Math.min(requestedMargin, Math.max(1, Math.floor((availableLines - 1) / 3)));
}

export function buildVisibleListLines(
  sections: ContentSection[],
  contentIndex: number,
  availableLines: number,
  options: BuildVisibleListLinesOptions = {}
): ListRenderLine[] {
  const allLines: ListRenderLine[] = [];
  let absoluteIndex = 1;
  const stickySectionIds = new Set(options.stickySectionIds ?? []);

  for (const section of sections) {
    if (!stickySectionIds.has(section.id)) {
      allLines.push({ type: "section", id: section.id, title: section.title });
    }

    for (const item of section.items) {
      allLines.push({
        type: "item",
        item,
        absoluteIndex
      });
      absoluteIndex += 1;
    }
  }

  if (allLines.length <= availableLines) {
    return allLines;
  }

  const selectedLineIndex = allLines.findIndex((line) => line.type === "item" && line.absoluteIndex === contentIndex);
  const targetIndex = selectedLineIndex >= 0 ? selectedLineIndex : 0;
  const scrollMargin = getListScrollMargin(availableLines, options.scrollMargin ?? 2);
  const windowStart = Math.max(0, Math.min(targetIndex - scrollMargin, allLines.length - availableLines));
  return allLines.slice(windowStart, windowStart + availableLines);
}

export function AppPageBody({
  mainView,
  browse,
  sections,
  contentIndex,
  focusRegion,
  width,
  height,
  player,
  linkPending
}: AppPageBodyProps) {
  const contentWidth = width - 4;
  const rowWidth = Math.max(1, contentWidth - 1);
  const viewLabel = getMainViewLabel(mainView);
  const playlistDetail = mainView === "playlist-detail" ? browse.playlistDetail : null;
  const playlistDetailMetadata = playlistDetail ? getPlaylistDetailMetadata(playlistDetail) : "";
  const playlistAccentWidth = playlistDetail ? Math.max(1, contentWidth - playlistDetailMetadata.length - 1) : 0;
  const showMainHeader = shouldRenderMainViewLabel(mainView, playlistDetail);
  const showHeader = Boolean(playlistDetail) || showMainHeader;
  const headerLineCount = showHeader ? 1 : 0;
  const listAvailableLines = Math.max(1, height - headerLineCount - 1);
  const visibleListLines =
    mainView === "home"
      ? []
      : buildVisibleListLines(sections, contentIndex, listAvailableLines, {
          stickySectionIds: playlistDetail ? ["playlist-tracks"] : []
        });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width} height={height} minHeight={height}>
      {showHeader ? (
        <Box marginBottom={1} flexDirection="column">
          {playlistDetail ? (
            <Text>
              <Text color="green" bold>
                {clipLine(iconLabel(NERD_ICONS.playlists, playlistDetail.name), playlistAccentWidth)}
              </Text>
              <Text color="white">
                {clipLine(` ${playlistDetailMetadata}`, Math.max(1, contentWidth - playlistAccentWidth))}
              </Text>
            </Text>
          ) : (
            <Text color="green" bold>
              {clipLine(viewLabel, contentWidth)}
            </Text>
          )}
        </Box>
      ) : null}
      {player.spotify === "relink-required" ? (
        <Text color="yellow">
          {clipLine(
            linkPending
              ? "Completing Spotify re-link..."
              : "Spotify permissions changed. Press [cmd+s] then [l] to re-link and restore Home, search, and your library.",
            contentWidth
          )}
        </Text>
      ) : player.spotify !== "linked" ? (
        <Text color="white">
          {clipLine(
            linkPending
              ? "Finish Spotify link to unlock Home and library."
              : "Link Spotify with [cmd+s] then [l] to unlock search, quick launch, and your library.",
            contentWidth
          )}
        </Text>
      ) : sections.length === 0 ? (
        <Text color="white">
          {clipLine(
            mainView === "playlist-detail"
              ? "This playlist has no playable tracks yet."
              : mainView === "search-results" && browse.submittedSearchQuery
              ? "No results for this query."
              : `Nothing to show in ${getMainViewLabel(mainView)} yet.`,
            contentWidth
          )}
        </Text>
      ) : (
        mainView === "home" ? (
          (() => {
            const tileWidth = Math.max(24, Math.floor((contentWidth - 2) / 2));
            let absoluteIndex = 1;

            return sections.map((section) => (
              <Box key={section.id} flexDirection="column" marginBottom={1}>
                <Text color="cyan">{section.title}</Text>
                <Box flexWrap="wrap">
                  {section.items.map((item) => {
                    const selected = absoluteIndex === contentIndex;
                    absoluteIndex += 1;
                    return renderTile(item, selected, focusRegion === "content", tileWidth);
                  })}
                </Box>
              </Box>
            ));
          })()
        ) : (
          visibleListLines.map((line) =>
            line.type === "section" ? (
              <Text key={`section-${line.id}`} color="cyan">
                {clipLine(line.title, contentWidth)}
              </Text>
            ) : (
              <React.Fragment key={getListItemRenderKey(line.item, line.absoluteIndex)}>
                {renderRow(line.item, line.absoluteIndex, line.absoluteIndex === contentIndex, focusRegion === "content", rowWidth)}
              </React.Fragment>
            )
          )
        )
      )}
    </Box>
  );
}
