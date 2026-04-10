import { Box, Text } from "ink";
import React from "react";
import type { ContentSection, AppFocusRegion, AppPage, ShellBrowseState } from "./app-shell-state";
import { getPageLabel } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

type AppPageBodyProps = {
  page: AppPage;
  browse: ShellBrowseState;
  sections: ContentSection[];
  contentIndex: number;
  focusRegion: AppFocusRegion;
  width: number;
  searchEditing: boolean;
  player: HomeSnapshot;
  linkPending: boolean;
};

export function AppPageBody({
  page,
  browse,
  sections,
  contentIndex,
  focusRegion,
  width,
  searchEditing,
  player,
  linkPending
}: AppPageBodyProps) {
  let absoluteIndex = 0;
  const contentWidth = width - 4;
  const itemCount = sections.reduce((total, section) => total + section.items.length, 0);

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
      {page !== "search" ? null : itemCount === 0 && !browse.searchBusy && browse.searchQuery ? (
        <Text color="white">{clipLine("No results for this query.", contentWidth)}</Text>
      ) : null}
    </Box>
  );
}
