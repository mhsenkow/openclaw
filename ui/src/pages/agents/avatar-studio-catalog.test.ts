import { describe, expect, it } from "vitest";
import {
  AVATAR_STUDIO_BROWSE_CATALOG,
  filterAvatarStudioCatalog,
} from "./avatar-studio-catalog.ts";

describe("filterAvatarStudioCatalog", () => {
  it("hides NSFW / red CivitAI entries until opted in", () => {
    const hidden = filterAvatarStudioCatalog(AVATAR_STUDIO_BROWSE_CATALOG, {
      query: "",
      includeNsfw: false,
    });
    expect(hidden.every((entry) => !entry.nsfw)).toBe(true);
    expect(hidden.some((entry) => entry.source === "civitai")).toBe(true);
    expect(hidden.some((entry) => entry.source === "huggingface")).toBe(true);

    const shown = filterAvatarStudioCatalog(AVATAR_STUDIO_BROWSE_CATALOG, {
      query: "",
      includeNsfw: true,
    });
    expect(shown.some((entry) => entry.nsfw)).toBe(true);
    expect(shown.length).toBeGreaterThan(hidden.length);
  });

  it("filters by label, source, and tags", () => {
    const flux = filterAvatarStudioCatalog(AVATAR_STUDIO_BROWSE_CATALOG, {
      query: "flux",
      includeNsfw: false,
    });
    expect(flux.length).toBeGreaterThan(0);
    expect(flux.every((entry) => !entry.nsfw)).toBe(true);
    expect(
      flux.every((entry) =>
        [entry.label, entry.hint, entry.source, ...entry.tags]
          .join(" ")
          .toLowerCase()
          .includes("flux"),
      ),
    ).toBe(true);

    const red = filterAvatarStudioCatalog(AVATAR_STUDIO_BROWSE_CATALOG, {
      query: "red",
      includeNsfw: true,
    });
    expect(red.some((entry) => entry.nsfw)).toBe(true);
  });
});
