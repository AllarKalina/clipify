import type { ApiClient } from "@clipify/api-client";
import type { Dispatch } from "react";
import type { AuthenticatedAppAction, AuthenticatedAppState } from "./authenticated-app-state";

export type AuthenticatedCommandContext = {
  client: ApiClient;
  dispatch: Dispatch<AuthenticatedAppAction>;
  getState: () => AuthenticatedAppState;
  onLogoutComplete: (successLine: string) => void;
  openBrowserOnLink: boolean;
};
