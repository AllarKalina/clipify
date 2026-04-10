import { Box, Text } from "ink";
import React from "react";
import { appPages, getPageLabel, type AppFocusRegion, type AppPage } from "./app-shell-state";
import { clipLine } from "./app-shell-utils";

function renderRow(content: string, selected: boolean, activeRegion: boolean) {
  return (
    <Text color={selected && activeRegion ? "black" : "white"} backgroundColor={selected && activeRegion ? "green" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

type AppSidebarProps = {
  width: number;
  page: AppPage;
  focusRegion: AppFocusRegion;
  userName: string;
};

export function AppSidebar({ width, page, focusRegion, userName }: AppSidebarProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} width={width}>
      <Text color="green" bold>
        CLIPIFY
      </Text>
      <Text color="white">{clipLine(userName, width - 4)}</Text>
      <Box marginTop={1} flexDirection="column">
        {appPages.map((entry) => (
          <React.Fragment key={entry}>
            {renderRow(clipLine(getPageLabel(entry), width - 4), page === entry, focusRegion === "sidebar")}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
