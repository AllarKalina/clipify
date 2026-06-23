import { describe, expect, test } from "bun:test";
import type { ContentItem } from "../src/app-shell-types";
import { buildProfileName, getSidebarListHeight, getVisibleSidebarItems } from "../src/app-sidebar";

function createSidebarItems(count: number): ContentItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    title: `Item ${index + 1}`,
    subtitle: "",
    action: { type: "noop" as const }
  }));
}

describe("app sidebar", () => {
  test("builds profile name from the user name", () => {
    expect(buildProfileName("Allar")).toBe("Allar");
  });

  test("uses fallback profile name for blank identity values", () => {
    expect(buildProfileName("   ")).toBe("unknown user");
  });

  test("keeps selected library row visible with profile moved to the sidebar bottom", () => {
    const items = createSidebarItems(9);
    const visible = getVisibleSidebarItems(items, 7, getSidebarListHeight(10));

    expect(getSidebarListHeight(10)).toBe(4);
    expect(visible.map((item) => item.id)).toEqual(["item-6", "item-7", "item-8", "item-9"]);
  });
});
