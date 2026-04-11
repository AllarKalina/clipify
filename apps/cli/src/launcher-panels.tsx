import { Box, Text } from "ink";
import React from "react";
import {
  getAuthActionOrder,
  getAuthFieldLabel,
  getAuthFieldOrder,
  getAuthTitle,
  getAuthToggleLabel,
  type AuthFieldKey,
  type AuthFormState
} from "./auth-form";

export type UnauthMenuAction = "signup" | "login" | "exit";

const spotifyAccentMark = [" ▄██▄ ", "██  ██", " ████ ", "  ▀▀  "] as const;
const controlsPanelWidth = 46;
const brandBlockWidth = 38;
const unauthMenuActions: UnauthMenuAction[] = ["signup", "login", "exit"];

function centerText(content: string, width: number): string {
  if (content.length >= width) {
    return content;
  }

  const totalPadding = width - content.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${" ".repeat(leftPadding)}${content}${" ".repeat(rightPadding)}`;
}

function formatUnauthMenuItem(label: string, selected: boolean): string {
  const prefix = selected ? "›" : " ";
  return `${prefix} ${label}`.padEnd(controlsPanelWidth - 4, " ");
}

function maskFieldValue(field: AuthFieldKey, value: string, active: boolean): string {
  if (field === "password") {
    return value ? "*".repeat(value.length) : active ? "••••••••" : "";
  }

  return value;
}

function formatPanelRow(content: string): string {
  const width = controlsPanelWidth - 4;
  if (content.length <= width) {
    return content.padEnd(width, " ");
  }

  return `${content.slice(0, Math.max(0, width - 1))}…`;
}

function formatAuthFieldRow(field: AuthFieldKey, value: string, active: boolean): string {
  const label = `${getAuthFieldLabel(field)}:`;
  const renderedValue = maskFieldValue(field, value, active) || (active ? "…" : "");
  return formatPanelRow(`${label.padEnd(11, " ")}${renderedValue}`);
}

function formatAuthActionRow(label: string): string {
  return formatPanelRow(`> ${label}`);
}

function renderFocusableRow(content: string, selected: boolean) {
  return (
    <Text color={selected ? "black" : "white"} backgroundColor={selected ? "cyan" : undefined} bold={selected}>
      {content}
    </Text>
  );
}

function AuthPanel({
  authForm,
  busy
}: {
  authForm: AuthFormState;
  busy: boolean;
}) {
  const fields = getAuthFieldOrder(authForm.mode);
  const actions = getAuthActionOrder(authForm.mode);
  const helperText =
    authForm.focus.kind === "field" ? "[↑↓] move  [esc] back  [enter] next" : "[↑↓] move  [esc] back  [enter] choose";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} width={controlsPanelWidth}>
      <Text color="cyan" bold>
        {getAuthTitle(authForm.mode)}
      </Text>
      <Text color="white">{authForm.mode === "signup" ? "Set up your local session" : "Resume your local session"}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Fields</Text>
        {fields.map((field) => {
          const selected = authForm.focus.kind === "field" && authForm.focus.field === field;
          return <React.Fragment key={field}>{renderFocusableRow(formatAuthFieldRow(field, authForm.values[field], selected), selected)}</React.Fragment>;
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Actions</Text>
        {actions.map((action) => {
          const selected = authForm.focus.kind === "action" && authForm.focus.action === action;
          let label = "Submit";

          if (action === "switch-mode") {
            label = getAuthToggleLabel(authForm.mode);
          }

          if (action === "back") {
            label = "Back";
          }

          return <React.Fragment key={action}>{renderFocusableRow(formatAuthActionRow(label), selected)}</React.Fragment>;
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="white">{helperText}</Text>
        {busy ? <Text color="yellow">submitting...</Text> : null}
        {!busy && authForm.message ? (
          <Text color={authForm.message.tone === "error" ? "red" : "cyan"}>{authForm.message.text}</Text>
        ) : null}
      </Box>
    </Box>
  );
}

export function BrandPanel({ showSubtitle = true }: { showSubtitle?: boolean }) {
  return (
    <Box flexDirection="column" alignItems="center" width={brandBlockWidth}>
      {spotifyAccentMark.map((line, lineIndex) => (
        <Text key={`brand-logo-line-${lineIndex}`} color={lineIndex < 2 ? "green" : "cyan"}>
          {centerText(line, brandBlockWidth)}
        </Text>
      ))}
      <Text color="green" bold>
        {centerText("CLIPIFY", brandBlockWidth)}
      </Text>
      {showSubtitle ? <Text color="white">{centerText("spotify control for terminal", brandBlockWidth)}</Text> : null}
    </Box>
  );
}

export function ControlsPanel({
  unauthSelection,
  helperLine,
  busy,
  statusLine,
  authForm
}: {
  unauthSelection: UnauthMenuAction;
  helperLine: string;
  busy: boolean;
  statusLine: string;
  authForm: AuthFormState | null;
}) {
  const showStatus = busy || Boolean(statusLine);

  if (authForm) {
    return <AuthPanel authForm={authForm} busy={busy} />;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} width={controlsPanelWidth}>
      <Text color="cyan" bold>
        Launcher
      </Text>
      <Text color="white">Session entry</Text>
      <Box marginTop={1} flexDirection="column">
        <Text
          color={unauthSelection === "signup" ? "black" : "white"}
          backgroundColor={unauthSelection === "signup" ? "cyan" : undefined}
          bold={unauthSelection === "signup"}
        >
          {formatUnauthMenuItem("Create account", unauthSelection === "signup")}
        </Text>
        <Text
          color={unauthSelection === "login" ? "black" : "white"}
          backgroundColor={unauthSelection === "login" ? "cyan" : undefined}
          bold={unauthSelection === "login"}
        >
          {formatUnauthMenuItem("Log in", unauthSelection === "login")}
        </Text>
        <Text
          color={unauthSelection === "exit" ? "black" : "white"}
          backgroundColor={unauthSelection === "exit" ? "cyan" : undefined}
          bold={unauthSelection === "exit"}
        >
          {formatUnauthMenuItem("Quit", unauthSelection === "exit")}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="white">{helperLine}</Text>
        {showStatus ? <Text color={busy ? "yellow" : "cyan"}>{busy ? "working..." : `status: ${statusLine}`}</Text> : null}
      </Box>
    </Box>
  );
}

export function nextUnauthSelection(current: UnauthMenuAction, direction: "up" | "down"): UnauthMenuAction {
  const index = unauthMenuActions.indexOf(current);
  if (index < 0) {
    return "signup";
  }

  if (direction === "up") {
    return unauthMenuActions[(index - 1 + unauthMenuActions.length) % unauthMenuActions.length] ?? "signup";
  }

  return unauthMenuActions[(index + 1) % unauthMenuActions.length] ?? "signup";
}
