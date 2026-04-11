import { describe, expect, test } from "bun:test";
import { requireSession } from "../src/modules/auth/session";

describe("auth session helper", () => {
  test("caches session lookups per request", async () => {
    let calls = 0;
    const auth = {
      api: {
        async getSession() {
          calls++;
          return {
            user: {
              id: "u_123",
              email: "a@example.com",
              name: "Allar"
            }
          };
        }
      }
    };
    const request = new Request("http://localhost/v1/me");

    await expect(requireSession(auth as never, request)).resolves.toEqual({
      user: {
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }
    });
    await expect(requireSession(auth as never, request)).resolves.toEqual({
      user: {
        id: "u_123",
        email: "a@example.com",
        name: "Allar"
      }
    });
    expect(calls).toBe(1);
  });

  test("rejects missing session with 401", async () => {
    const auth = {
      api: {
        async getSession() {
          return null;
        }
      }
    };

    await expect(requireSession(auth as never, new Request("http://localhost/v1/me"))).rejects.toBeInstanceOf(Response);
  });
});
