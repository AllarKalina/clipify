import { describe, expect, test } from "bun:test";
import { selectShellViewModel } from "../src/authenticated-app-selectors";
import { createInitialAuthenticatedAppState } from "../src/authenticated-app-state";

describe("authenticated app home selectors", () => {
  test("orders quick launch playlists with pinned and owned playlists first", () => {
    const state = {
      ...createInitialAuthenticatedAppState(""),
      homeSnapshot: {
        ...createInitialAuthenticatedAppState("").homeSnapshot,
        backend: "connected" as const,
        spotify: "linked" as const,
        userName: "Allar",
        spotifyDisplayName: "Allar Kalina"
      },
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        playlists: [
          {
            id: "playlist-z",
            name: "Zoo",
            description: "",
            imageUrl: "",
            ownerName: "Another User",
            isPinned: false,
            trackCount: 5,
            uri: "spotify:playlist:z"
          },
          {
            id: "playlist-a",
            name: "Alpha",
            description: "",
            imageUrl: "",
            ownerName: "Allar Kalina",
            isPinned: false,
            trackCount: 10,
            uri: "spotify:playlist:a"
          },
          {
            id: "playlist-p",
            name: "Pinned Mix",
            description: "",
            imageUrl: "",
            ownerName: "Another User",
            isPinned: true,
            trackCount: 20,
            uri: "spotify:playlist:p"
          }
        ]
      }
    };

    const viewModel = selectShellViewModel(state);
    expect(viewModel.activeSections[0]?.items.map((item) => item.title)).toEqual(["Pinned Mix", "Alpha", "Zoo"]);
  });
});
