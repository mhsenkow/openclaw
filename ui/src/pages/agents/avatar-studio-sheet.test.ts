/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cropAvatarSheetQuadrants, encodeAvatarPortrait } from "./avatar-studio-sheet.ts";

describe("avatar studio sheet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("crops a 2x2 sheet into four data URLs", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi
      .fn()
      .mockReturnValueOnce("data:image/webp;base64,aaa")
      .mockReturnValueOnce("data:image/webp;base64,bbb")
      .mockReturnValueOnce("data:image/webp;base64,ccc")
      .mockReturnValueOnce("data:image/webp;base64,ddd");
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 128, height: 128, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);

    const options = await cropAvatarSheetQuadrants(new Blob(["x"], { type: "image/png" }));
    expect(options).toEqual([
      "data:image/webp;base64,aaa",
      "data:image/webp;base64,bbb",
      "data:image/webp;base64,ccc",
      "data:image/webp;base64,ddd",
    ]);
    expect(drawImage).toHaveBeenCalledTimes(4);
  });

  it("encodes a single portrait", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 64, height: 48, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/webp;base64,portrait",
    );

    await expect(encodeAvatarPortrait(new Blob(["x"], { type: "image/png" }))).resolves.toBe(
      "data:image/webp;base64,portrait",
    );
  });
});
