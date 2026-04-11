import type { ApiClient } from "@clipify/api-client";
import { Box, render, useApp, useInput, useStdout } from "ink";
import React, { useMemo, useState } from "react";
import {
  advanceAuthForm,
  createAuthFormState,
  getFocusedValue,
  moveAuthFocus,
  switchAuthMode,
  updateFocusedValue,
  type AuthFormState
} from "./auth-form";
import { getAuthLauncherSelection, submitAuthForm } from "./auth-controller";
import { AuthenticatedAppController } from "./authenticated-app-controller";
import { clearSessionCookie, saveSessionCookie } from "./config";
import { BrandPanel, ControlsPanel, nextUnauthSelection, type UnauthMenuAction } from "./launcher-panels";

export type AppDeps = {
  apiBaseUrl: string;
  initialSessionCookie?: string;
  openBrowser: boolean;
  pinnedPlaylistNames: string[];
  makeClient: (sessionCookie?: string) => ApiClient;
};

function App(props: AppDeps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const stdoutWidth = stdout.columns ?? 120;
  const stdoutHeight = stdout.rows ?? 40;
  const showSubtitle = stdoutHeight >= 20;
  const helperLine = stdoutHeight >= 22 ? "[↑↓] navigate  [enter] select" : "[↑↓] move  [enter] select";
  const [sessionCookie, setSessionCookie] = useState<string | undefined>(props.initialSessionCookie);
  const [authForm, setAuthForm] = useState<AuthFormState | null>(null);
  const [statusLine, setStatusLine] = useState(() => (props.initialSessionCookie ? "Restoring session..." : ""));
  const [busy, setBusy] = useState(false);
  const [unauthSelection, setUnauthSelection] = useState<UnauthMenuAction>("signup");
  const [autoStartLink, setAutoStartLink] = useState(false);

  const client = useMemo(() => props.makeClient(sessionCookie), [props, sessionCookie]);
  const isAuthenticated = Boolean(sessionCookie);

  const completeLocalLogout = (successLine: string) => {
    clearSessionCookie();
    setSessionCookie(undefined);
    setAuthForm(null);
    setBusy(false);
    setUnauthSelection("login");
    setAutoStartLink(false);
    setStatusLine(successLine);
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (busy || isAuthenticated) {
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (authForm) {
      if (key.escape) {
        setAuthForm(null);
        setStatusLine("");
        setUnauthSelection(getAuthLauncherSelection(authForm.mode));
        return;
      }

      if (key.upArrow) {
        setAuthForm((current) => (current ? moveAuthFocus(current, "up") : current));
        return;
      }

      if (key.downArrow) {
        setAuthForm((current) => (current ? moveAuthFocus(current, "down") : current));
        return;
      }

      if (key.backspace || key.delete) {
        setAuthForm((current) => {
          if (!current || current.focus.kind !== "field") {
            return current;
          }

          return updateFocusedValue(current, getFocusedValue(current).slice(0, -1));
        });
        return;
      }

      if (key.return) {
        if (authForm.focus.kind === "field") {
          setAuthForm((current) => (current ? advanceAuthForm(current) : current));
          return;
        }

        if (authForm.focus.action === "switch-mode") {
          setAuthForm((current) => (current ? switchAuthMode(current) : current));
          return;
        }

        if (authForm.focus.action === "back") {
          setAuthForm(null);
          setStatusLine("");
          setUnauthSelection(getAuthLauncherSelection(authForm.mode));
          return;
        }

        setBusy(true);
        void (async () => {
          try {
            const result = await submitAuthForm(authForm, {
              client,
              persistSession: saveSessionCookie
            });

            if (result.kind === "error") {
              setAuthForm(result.form);
              return;
            }

            setSessionCookie(result.sessionCookie);
            setAuthForm(null);
            setAutoStartLink(true);
            setStatusLine(result.successLine);
          } finally {
            setBusy(false);
          }
        })();
        return;
      }

      if (input && !key.tab && authForm.focus.kind === "field") {
        setAuthForm((current) => (current ? updateFocusedValue(current, `${getFocusedValue(current)}${input}`) : current));
      }
      return;
    }

    if (key.upArrow || key.leftArrow) {
      setUnauthSelection((current) => nextUnauthSelection(current, "up"));
      return;
    }

    if (key.downArrow || key.rightArrow) {
      setUnauthSelection((current) => nextUnauthSelection(current, "down"));
      return;
    }

    if (key.return) {
      if (unauthSelection === "exit") {
        exit();
        return;
      }

      setAuthForm(createAuthFormState(unauthSelection === "signup" ? "signup" : "login"));
      setStatusLine("");
    }
  });

  if (!isAuthenticated) {
    return (
      <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight} justifyContent="center" alignItems="center">
        <BrandPanel showSubtitle={showSubtitle} />
        <Box marginTop={1}>
          <ControlsPanel
            unauthSelection={unauthSelection}
            helperLine={helperLine}
            busy={busy}
            statusLine={statusLine}
            authForm={authForm}
          />
        </Box>
      </Box>
    );
  }

  return (
    <AuthenticatedAppController
      client={client}
      width={stdoutWidth}
      height={stdoutHeight}
      initialStatusLine={statusLine}
      openBrowserOnLink={props.openBrowser}
      autoStartLink={autoStartLink}
      pinnedPlaylistNames={props.pinnedPlaylistNames}
      onLogoutComplete={completeLocalLogout}
      onExit={exit}
    />
  );
}

export async function runTerminalApp(deps: AppDeps): Promise<void> {
  const instance = render(<App {...deps} />);

  await new Promise<void>((resolve) => {
    instance.waitUntilExit().then(resolve);
  });
}
