import type { ContentItem, ContentSection, MainView } from "./app-shell-types";
import { iconLabel, NERD_ICONS } from "./nerd-icons";

export function getMainViewLabel(mainView: MainView): string {
  return mainView === "home"
    ? iconLabel(NERD_ICONS.home, "Home")
    : mainView === "search-results"
      ? iconLabel(NERD_ICONS.search, "Search")
      : mainView === "liked-tracks"
        ? iconLabel(NERD_ICONS.liked, "Liked songs")
        : iconLabel(NERD_ICONS.playlists, "Playlist");
}

export function moveSelection(current: number, direction: "up" | "down", itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (direction === "up") {
    return Math.max(0, current - 1);
  }

  return Math.min(itemCount - 1, current + 1);
}

export function flattenSections(sections: ContentSection[]): ContentItem[] {
  return sections.flatMap((section) => section.items);
}
