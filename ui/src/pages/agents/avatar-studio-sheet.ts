// Crop a 2×2 avatar choice sheet into four identity-ready data URLs.
import { AVATAR_MAX_BYTES } from "../../../../src/shared/avatar-limits.js";

const AVATAR_TARGET_SIZE = 96;
const AVATAR_EDITOR_MAX_DATA_URL_CHARS = 16_000;

export type AvatarSheetQuadrant = 0 | 1 | 2 | 3;

function boundAvatarDataUrl(value: string | null): string | null {
  return value && value.length <= AVATAR_EDITOR_MAX_DATA_URL_CHARS ? value : null;
}

function encodeCanvas(canvas: HTMLCanvasElement): string | null {
  const webp = canvas.toDataURL("image/webp", 0.8);
  return boundAvatarDataUrl(
    webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png"),
  );
}

/** Scale a bitmap region into an identity-bounded avatar data URL. */
export function encodeAvatarBitmapRegion(
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): string | null {
  const side = Math.max(1, Math.min(sw, sh));
  const scale = Math.min(1, AVATAR_TARGET_SIZE / side);
  const width = Math.max(1, Math.round(side * scale));
  const height = width;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, width, height);
  return encodeCanvas(canvas);
}

/** Split a square 2×2 sheet into four top-left → bottom-right portraits. */
export async function cropAvatarSheetQuadrants(
  source: Blob | ImageBitmap,
): Promise<Array<string | null>> {
  const bitmap =
    typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap
      ? source
      : await createImageBitmap(source as Blob);
  try {
    const halfW = Math.floor(bitmap.width / 2);
    const halfH = Math.floor(bitmap.height / 2);
    if (halfW < 8 || halfH < 8) {
      return [null, null, null, null];
    }
    return [
      encodeAvatarBitmapRegion(bitmap, 0, 0, halfW, halfH),
      encodeAvatarBitmapRegion(bitmap, halfW, 0, halfW, halfH),
      encodeAvatarBitmapRegion(bitmap, 0, halfH, halfW, halfH),
      encodeAvatarBitmapRegion(bitmap, halfW, halfH, halfW, halfH),
    ];
  } finally {
    if (!(typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)) {
      bitmap.close();
    }
  }
}

/** Encode a single portrait image the same way Choose image does. */
export async function encodeAvatarPortrait(blob: Blob): Promise<string | null> {
  if (!blob.type.startsWith("image/") || blob.size > AVATAR_MAX_BYTES) {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const side = Math.min(bitmap.width, bitmap.height);
      const sx = Math.floor((bitmap.width - side) / 2);
      const sy = Math.floor((bitmap.height - side) / 2);
      return encodeAvatarBitmapRegion(bitmap, sx, sy, side, side);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
