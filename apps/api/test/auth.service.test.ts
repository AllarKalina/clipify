import { describe, expect, test } from "bun:test";
import { buildTrustedOrigins } from "../src/modules/auth/service";

describe("auth service", () => {
  test("includes loopback aliases for localhost auth url", () => {
    const origins = buildTrustedOrigins("http://localhost:3000");

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://127.0.0.1:3000");
    expect(origins).toContain("http://[::1]:3000");
  });

  test("keeps non-loopback auth url unchanged", () => {
    const origins = buildTrustedOrigins("https://clipify.example.com");

    expect(origins).toEqual(["https://clipify.example.com"]);
  });
});
