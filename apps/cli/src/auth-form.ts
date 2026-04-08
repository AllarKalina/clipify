export type AuthMode = "signup" | "login";
export type AuthFieldKey = "name" | "email" | "password";
export type AuthActionKey = "submit" | "switch-mode" | "back";
export type AuthFocus =
  | { kind: "field"; field: AuthFieldKey }
  | { kind: "action"; action: AuthActionKey };

export type AuthValues = {
  name: string;
  email: string;
  password: string;
};

export type AuthFormMessage = {
  tone: "error" | "info";
  text: string;
};

export type AuthFormState = {
  focus: AuthFocus;
  message: AuthFormMessage | null;
  mode: AuthMode;
  values: AuthValues;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getAuthFieldOrder(mode: AuthMode): AuthFieldKey[] {
  return mode === "signup" ? ["name", "email", "password"] : ["email", "password"];
}

export function getAuthActionOrder(mode: AuthMode): AuthActionKey[] {
  return ["submit", "switch-mode", "back"];
}

export function getAuthFieldLabel(field: AuthFieldKey): string {
  switch (field) {
    case "name":
      return "Name";
    case "email":
      return "Email";
    case "password":
      return "Password";
  }
}

export function getAuthTitle(mode: AuthMode): string {
  return mode === "signup" ? "Create account" : "Log in";
}

export function getAuthToggleLabel(mode: AuthMode): string {
  return mode === "signup" ? "Switch to log in" : "Switch to create account";
}

export function createAuthFormState(mode: AuthMode, seed?: Partial<AuthValues>): AuthFormState {
  const firstField = getAuthFieldOrder(mode)[0] ?? "email";

  return {
    focus: { kind: "field", field: firstField },
    message: null,
    mode,
    values: {
      name: seed?.name ?? "",
      email: seed?.email ?? "",
      password: seed?.password ?? ""
    }
  };
}

export function switchAuthMode(state: AuthFormState): AuthFormState {
  const mode = state.mode === "signup" ? "login" : "signup";
  return createAuthFormState(mode, {
    email: state.values.email
  });
}

export function getFocusedValue(state: AuthFormState): string {
  if (state.focus.kind !== "field") {
    return "";
  }

  return state.values[state.focus.field];
}

export function updateFocusedValue(state: AuthFormState, nextValue: string): AuthFormState {
  if (state.focus.kind !== "field") {
    return state;
  }

  return {
    ...state,
    message: null,
    values: {
      ...state.values,
      [state.focus.field]: nextValue
    }
  };
}

export function moveAuthFocus(state: AuthFormState, direction: "up" | "down"): AuthFormState {
  const order = [...getAuthFieldOrder(state.mode).map((field) => ({ kind: "field" as const, field })), ...getAuthActionOrder(state.mode).map((action) => ({ kind: "action" as const, action }))];
  const currentIndex = order.findIndex((item) => {
    if (item.kind !== state.focus.kind) {
      return false;
    }

    if (item.kind === "field" && state.focus.kind === "field") {
      return item.field === state.focus.field;
    }

    if (item.kind === "action" && state.focus.kind === "action") {
      return item.action === state.focus.action;
    }

    return false;
  });

  if (currentIndex < 0) {
    return state;
  }

  const nextIndex =
    direction === "up" ? (currentIndex - 1 + order.length) % order.length : (currentIndex + 1) % order.length;

  return {
    ...state,
    focus: order[nextIndex] ?? state.focus
  };
}

function validateFieldValue(field: AuthFieldKey, value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return `${getAuthFieldLabel(field)} is required`;
  }

  if (field === "email" && !emailPattern.test(trimmedValue)) {
    return "Enter a valid email address";
  }

  if (field === "password" && value.length < 8) {
    return "Password must be at least 8 characters";
  }

  return null;
}

export function validateAuthForm(state: AuthFormState): string | null {
  for (const field of getAuthFieldOrder(state.mode)) {
    const fieldError = validateFieldValue(field, state.values[field]);
    if (fieldError) {
      return fieldError;
    }
  }

  return null;
}

export function advanceAuthForm(state: AuthFormState): AuthFormState {
  if (state.focus.kind !== "field") {
    return state;
  }

  const fieldError = validateFieldValue(state.focus.field, state.values[state.focus.field]);
  if (fieldError) {
    return {
      ...state,
      message: {
        tone: "error",
        text: fieldError
      }
    };
  }

  const fields = getAuthFieldOrder(state.mode);
  const currentIndex = fields.indexOf(state.focus.field);
  const nextField = fields[currentIndex + 1];

  if (nextField) {
    return {
      ...state,
      focus: { kind: "field", field: nextField },
      message: null
    };
  }

  return {
    ...state,
    focus: { kind: "action", action: "submit" },
    message: null
  };
}

export function focusFirstInvalidField(state: AuthFormState): AuthFormState {
  for (const field of getAuthFieldOrder(state.mode)) {
    const fieldError = validateFieldValue(field, state.values[field]);
    if (fieldError) {
      return {
        ...state,
        focus: { kind: "field", field },
        message: {
          tone: "error",
          text: fieldError
        }
      };
    }
  }

  return state;
}
