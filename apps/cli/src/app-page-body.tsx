import { Box, Text } from "ink";
import React from "react";
import type { ContentItem, ContentSection, AppFocusRegion, MainView, ShellBrowseState } from "./app-shell-state";
import { getMainViewLabel } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

function renderTile(item: ContentItem, selected: boolean, activeRegion: boolean, width: number) {
  const lineOne = clipLine(item.title, width - 2);
  const lineTwo = clipLine(item.subtitle || item.meta || " ", width - 2);

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
  const windowStart = Math.max(0, Math.min(targetIndex, allLines.length - availableLines));
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
  searchEditing,
  player,
  linkPending
}: AppPageBodyProps) {
  const contentWidth = width - 4;
  const rowWidth = Math.max(1, contentWidth - 1);
  const viewLabel = getMainViewLabel(mainView);
  const playlistDetail = mainView === "playlist-detail" ? browse.playlistDetail : null;
  const playlistDetailMetadata = playlistDetail ? getPlaylistDetailMetadata(playlistDetail) : "";
  const playlistAccentWidth = playlistDetail ? Math.max(1, contentWidth - playlistDetailMetadata.length - 1) : 0;
  const headerLineCount = playlistDetail ? 2 : 1;
  const listAvailableLines = Math.max(1, height - headerLineCount - 1);
  const visibleListLines =
    mainView === "home"
      ? []
      : buildVisibleListLines(sections, contentIndex, listAvailableLines, {
          stickySectionIds: playlistDetail ? ["playlist-tracks"] : []
        });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width} height={height} minHeight={height}>
      <Box marginBottom={1} flexDirection="column">
        <Text color="green" bold>
          {clipLine(viewLabel, contentWidth)}
        </Text>
        {playlistDetail ? (
          <Text>
            <Text color="green" bold>
              {clipLine(iconLabel(NERD_ICONS.playlists, playlistDetail.name), playlistAccentWidth)}
            </Text>
            <Text color="white">
              {clipLine(` ${playlistDetailMetadata}`, Math.max(1, contentWidth - playlistAccentWidth))}
            </Text>
          </Text>
        ) : null}
      </Box>
      {player.spotify === "relink-required" ? (
        <Text color="yellow">
          {clipLine(
            linkPending
              ? "Completing Spotify re-link..."
              : "Spotify permissions changed. Press [l] to re-link and restore Home, search, and your library.",
            contentWidth
          )}
        </Text>
      ) : player.spotify !== "linked" ? (
        <Text color="white">
          {clipLine(
            linkPending
              ? "Finish Spotify link to unlock Home and library."
              : "Link Spotify with [l] to unlock search, quick launch, and your library.",
            contentWidth
          )}
        </Text>
      ) : sections.length === 0 ? (
        <Text color="white">
          {clipLine(
            mainView === "playlist-detail"
              ? "This playlist has no playable tracks yet."
              : mainView === "search-results" && browse.searchQuery
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
              <React.Fragment key={line.item.id}>
                {renderRow(
                  clipLine(
                    line.item.meta
                      ? `${line.item.title} · ${line.item.subtitle} · ${line.item.meta}`
                      : `${line.item.title} · ${line.item.subtitle}`,
                    rowWidth
                  ),
                  line.absoluteIndex === contentIndex,
                  focusRegion === "content"
                )}
              </React.Fragment>
            )
          )
        )
      )}
      {!searchEditing && mainView === "home" ? (
        <Text color="white">{clipLine("Quick launch starts playback. Sidebar opens library detail. Featured picks open detail.", contentWidth)}</Text>
      ) : null}
    </Box>
  );
}
