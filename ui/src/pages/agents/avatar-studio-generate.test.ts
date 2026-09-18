import { describe, expect, it } from "vitest";
import {
  extractAvatarStudioMediaPaths,
  isAvatarImageGenerationReady,
} from "./avatar-studio-generate.ts";

describe("extractAvatarStudioMediaPaths", () => {
  it("dedupes mediaUrls, paths, and attachment paths", () => {
    expect(
      extractAvatarStudioMediaPaths({
        details: {
          media: { mediaUrls: ["/tmp/a.png"] },
          paths: ["/tmp/a.png", "/tmp/b.png"],
          attachments: [{ path: "/tmp/c.png" }],
        },
      }),
    ).toEqual(["/tmp/a.png", "/tmp/b.png", "/tmp/c.png"]);
  });
});

describe("isAvatarImageGenerationReady", () => {
  it("treats configured providers as ready (canonical list field)", () => {
    expect(isAvatarImageGenerationReady({ providers: [{ id: "fal", configured: true }] })).toBe(
      true,
    );
    expect(isAvatarImageGenerationReady({ providers: [{ id: "fal", configured: false }] })).toBe(
      false,
    );
    expect(isAvatarImageGenerationReady({ providers: [] })).toBe(false);
    expect(isAvatarImageGenerationReady(null)).toBe(false);
  });

  it("tolerates legacy ready flags", () => {
    expect(isAvatarImageGenerationReady({ providers: [{ id: "fal", ready: true }] })).toBe(true);
  });
});
