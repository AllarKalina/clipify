import { describe, expect, test } from "bun:test";
import {
  applyProgressTick,
  createInitialHomeSnapshot,
  reconcilePlayerDevice,
  shouldBackgroundRefresh,
  shouldTickPlayback
} from "../src/home-state";

describe("home state utilities", () => {
  test("initial snapshot starts offline and unknown spotify state", () => {
    const snapshot = createInitialHomeSnapshot();
    expect(snapshot.backend).toBe("offline");
    expect(snapshot.spotify).toBe("unknown");
    expect(snapshot.playbackState).toBe("idle");
  });

  test("reconciles active device data", () => {
    const snapshot = createInitialHomeSnapshot();
    const next = reconcilePlayerDevice(snapshot, [
      {
        id: "device-1",
        name: "MacBook Air",
        type: "Computer",
        isActive: true,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 55
      }
    ]);

    expect(next.deviceName).toBe("MacBook Air");
    expect(next.deviceStatus).toBe("active");
    expect(next.volumePercent).toBe(55);
  });

  test("falls back to available primary device when no active device exists", () => {
    const snapshot = createInitialHomeSnapshot();
    const next = reconcilePlayerDevice(snapshot, [
      {
        id: "device-2",
        name: "Living Room",
        type: "Speaker",
        isActive: false,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 35
      }
    ]);

    expect(next.deviceName).toBe("Living Room");
    expect(next.deviceStatus).toBe("available");
  });

  test("does not preserve stale active device when only available devices remain", () => {
    const snapshot = {
      ...createInitialHomeSnapshot(),
      deviceId: "device-1",
      deviceName: "MacBook Air",
      deviceType: "Computer",
      deviceStatus: "active" as const,
      supportsVolume: true,
      volumePercent: 55
    };
    const next = reconcilePlayerDevice(snapshot, [
      {
        id: "device-2",
        name: "Living Room",
        type: "Speaker",
        isActive: false,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 35
      }
    ]);

    expect(next.deviceId).toBe("device-2");
    expect(next.deviceName).toBe("Living Room");
    expect(next.deviceStatus).toBe("available");
    expect(next.volumePercent).toBe(35);
  });

  test("ticks progress only while actively playing", () => {
    const snapshot = {
      ...createInitialHomeSnapshot(),
      backend: "connected" as const,
      spotify: "linked" as const,
      playbackState: "playing" as const,
      progressMs: 1000,
      durationMs: 5000
    };

    expect(shouldTickPlayback(snapshot)).toBeTrue();
    expect(shouldBackgroundRefresh(snapshot)).toBeTrue();
    expect(applyProgressTick(snapshot, 2000).progressMs).toBe(3000);
    expect(applyProgressTick(snapshot, 6000).progressMs).toBe(5000);
  });

  test("does not tick progress when paused", () => {
    const snapshot = {
      ...createInitialHomeSnapshot(),
      backend: "connected" as const,
      spotify: "linked" as const,
      playbackState: "paused" as const,
      progressMs: 1000,
      durationMs: 5000
    };

    expect(shouldTickPlayback(snapshot)).toBeFalse();
    expect(shouldBackgroundRefresh(snapshot)).toBeFalse();
    expect(applyProgressTick(snapshot, 1000).progressMs).toBe(1000);
  });
});
