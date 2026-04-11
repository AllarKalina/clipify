import { describe, expect, test } from "bun:test";
import { clampDeviceSelection, describeAvailableDevice, describePlayerDevice, getPlayerDeviceHint } from "../src/device-picker-state";

describe("device picker state", () => {
  test("describes player device states clearly", () => {
    expect(
      describePlayerDevice({
        deviceName: "MacBook Pro",
        deviceType: "Computer",
        deviceStatus: "active"
      })
    ).toBe("MacBook Pro · computer");

    expect(
      describePlayerDevice({
        deviceName: "Living Room",
        deviceType: "Speaker",
        deviceStatus: "available"
      })
    ).toBe("Living Room · speaker ready elsewhere");

    expect(
      describePlayerDevice({
        deviceName: "",
        deviceType: "",
        deviceStatus: "none"
      })
    ).toBe("No active Spotify device");
  });

  test("describes player device hints clearly", () => {
    expect(
      getPlayerDeviceHint({
        spotify: "linked",
        deviceName: "Living Room",
        deviceStatus: "available"
      })
    ).toBe("Living Room is available, but playback is controlled elsewhere. Press [d] to transfer.");

    expect(
      getPlayerDeviceHint({
        spotify: "linked",
        deviceName: "",
        deviceStatus: "none"
      })
    ).toBe("No active Spotify device. Start playback in Spotify or press [d] to transfer.");
  });

  test("describes available devices for picker rows", () => {
    expect(
      describeAvailableDevice({
        id: "device-1",
        name: "MacBook Pro",
        type: "Computer",
        isActive: true,
        isRestricted: false,
        supportsVolume: true,
        volumePercent: 60
      })
    ).toBe("MacBook Pro · computer · active");

    expect(
      describeAvailableDevice({
        id: "device-2",
        name: "Office Speaker",
        type: "Speaker",
        isActive: false,
        isRestricted: true,
        supportsVolume: false,
        volumePercent: 0
      })
    ).toBe("Office Speaker · speaker · restricted");
  });

  test("clamps device selection to valid range", () => {
    expect(clampDeviceSelection(-1, 3)).toBe(0);
    expect(clampDeviceSelection(2, 3)).toBe(2);
    expect(clampDeviceSelection(8, 3)).toBe(2);
    expect(clampDeviceSelection(4, 0)).toBe(0);
  });
});
