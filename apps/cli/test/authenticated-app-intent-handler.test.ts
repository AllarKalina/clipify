import { describe, expect, test } from "bun:test";
import { handleAuthenticatedIntent } from "../src/authenticated-app-intent-handler";
import {
  authenticatedAppReducer,
  createInitialAuthenticatedAppState,
  type AuthenticatedAppAction
} from "../src/authenticated-app-state";

describe("authenticated app intent handler", () => {
  test("search deletion intents reactivate the input and edit the draft", () => {
    let state = {
      ...createInitialAuthenticatedAppState(""),
      searchEditing: false,
      browseState: {
        ...createInitialAuthenticatedAppState("").browseState,
        searchQuery: "hello world"
      }
    };
    const dispatch = (action: AuthenticatedAppAction) => {
      state = authenticatedAppReducer(state, action);
    };
    const baseArgs = {
      dispatch,
      context: {} as never,
      onExit: () => {},
      playerModeMutationsInFlight: { current: 0 }
    };

    handleAuthenticatedIntent({
      ...baseArgs,
      state,
      intent: { type: "trim-search-query-word" }
    });

    expect(state.searchEditing).toBeTrue();
    expect(state.browseState.searchQuery).toBe("hello ");

    handleAuthenticatedIntent({
      ...baseArgs,
      state,
      intent: { type: "clear-search-query" }
    });

    expect(state.searchEditing).toBeTrue();
    expect(state.browseState.searchQuery).toBe("");
  });
});
