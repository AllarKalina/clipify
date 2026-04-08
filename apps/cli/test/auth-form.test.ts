import { describe, expect, test } from "bun:test";
import {
  advanceAuthForm,
  createAuthFormState,
  focusFirstInvalidField,
  moveAuthFocus,
  switchAuthMode,
  updateFocusedValue,
  validateAuthForm
} from "../src/auth-form";

describe("auth form state", () => {
  test("signup advances through fields to submit", () => {
    let state = createAuthFormState("signup");
    state = updateFocusedValue(state, "Allar");
    state = advanceAuthForm(state);
    expect(state.focus).toEqual({ kind: "field", field: "email" });

    state = updateFocusedValue(state, "allar@example.com");
    state = advanceAuthForm(state);
    expect(state.focus).toEqual({ kind: "field", field: "password" });

    state = updateFocusedValue(state, "Tere1234");
    state = advanceAuthForm(state);
    expect(state.focus).toEqual({ kind: "action", action: "submit" });
  });

  test("login validates email format before advancing", () => {
    let state = createAuthFormState("login");
    state = updateFocusedValue(state, "not-an-email");
    state = advanceAuthForm(state);

    expect(state.focus).toEqual({ kind: "field", field: "email" });
    expect(state.message?.text).toBe("Enter a valid email address");
  });

  test("mode switch keeps email and clears password", () => {
    let state = createAuthFormState("signup", {
      email: "allar@example.com",
      name: "Allar",
      password: "secret123"
    });

    state = switchAuthMode(state);
    expect(state.mode).toBe("login");
    expect(state.values.email).toBe("allar@example.com");
    expect(state.values.password).toBe("");
    expect(state.focus).toEqual({ kind: "field", field: "email" });
  });

  test("focus movement reaches action rows", () => {
    let state = createAuthFormState("login");
    state = moveAuthFocus(state, "down");
    state = moveAuthFocus(state, "down");

    expect(state.focus).toEqual({ kind: "action", action: "submit" });
  });

  test("focusFirstInvalidField targets the first missing field", () => {
    let state = createAuthFormState("signup", {
      name: "Allar",
      email: "",
      password: ""
    });

    state = focusFirstInvalidField(state);
    expect(state.focus).toEqual({ kind: "field", field: "email" });
    expect(state.message?.text).toBe("Email is required");
  });

  test("validateAuthForm enforces password length", () => {
    const state = createAuthFormState("login", {
      email: "allar@example.com",
      password: "short"
    });

    expect(validateAuthForm(state)).toBe("Password must be at least 8 characters");
  });
});
