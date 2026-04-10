import { Box, Text } from "ink";
import React from "react";
import type { ContentItem, ContentSection, AppFocusRegion, MainView, ShellBrowseState } from "./app-shell-state";
import { getMainViewLabel } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";
import type { HomeSnapshot } from "./home-state";

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
  searchEditing: boolean;
  player: HomeSnapshot;
  linkPending: boolean;
};

export function AppPageBody({
  mainView,
  browse,
  sections,
  contentIndex,
  focusRegion,
  width,
  searchEditing,
  player,
  linkPending
}: AppPageBodyProps) {
  const contentWidth = width - 4;
  const searchSelected = contentIndex === 0;
  let absoluteIndex = 1;
  const viewLabel = getMainViewLabel(mainView);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Box marginBottom={1} flexDirection="column">
        <Text color="green" bold>
          {clipLine(viewLabel, contentWidth)}
        </Text>
        <Text color="cyan">{clipLine(mainView === "home" ? "What do you want to play?" : "[h] Home  What do you want to play?", contentWidth)}</Text>
        <Text color={searchSelected && focusRegion === "content" ? "black" : "white"} backgroundColor={searchSelected && focusRegion === "content" ? "green" : undefined}>
          {clipLine(browse.searchQuery || "Type [/] or press [enter] to search", contentWidth)}
        </Text>
        {browse.searchError ? <Text color="red">{clipLine(browse.searchError, contentWidth)}</Text> : null}
        {browse.searchBusy ? <Text color="yellow">{clipLine("Searching Spotify...", contentWidth)}</Text> : null}
      </Box>
      {player.spotify !== "linked" ? (
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
            mainView === "search-results" && browse.searchQuery
              ? "No results for this query."
              : `Nothing to show in ${getMainViewLabel(mainView)} yet.`,
            contentWidth
          )}
        </Text>
      ) : (
        sections.map((section) => {
          const tileMode = mainView === "home";
          const tileWidth = Math.max(24, Math.floor((contentWidth - 2) / 2));

          return (
            <Box key={section.id} flexDirection="column" marginBottom={1}>
              <Text color="cyan">{section.title}</Text>
              {tileMode ? (
                <Box flexWrap="wrap">
                  {section.items.map((item) => {
                    const selected = absoluteIndex === contentIndex;
                    absoluteIndex += 1;
                    return renderTile(item, selected, focusRegion === "content", tileWidth);
                  })}
                </Box>
              ) : (
                section.items.map((item) => {
                  const selected = absoluteIndex === contentIndex;
                  const row = clipLine(
                    item.meta ? `${item.title} · ${item.subtitle} · ${item.meta}` : `${item.title} · ${item.subtitle}`,
                    contentWidth
                  );
                  absoluteIndex += 1;
                  return <React.Fragment key={item.id}>{renderRow(row, selected, focusRegion === "content")}</React.Fragment>;
                })
              )}
            </Box>
          );
        })
      )}
      {!searchEditing && mainView === "home" ? (
        <Text color="white">{clipLine("Quick launch starts playback. Sidebar opens library detail. Featured picks open detail.", contentWidth)}</Text>
      ) : null}
    </Box>
  );
}
