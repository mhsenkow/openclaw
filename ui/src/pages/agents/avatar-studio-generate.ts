// Invoke image_generate for the Agents avatar studio and load the sheet bytes.
import type { GatewayBrowserClient } from "../../api/gateway.ts";
import { buildAssistantMediaUrl } from "../../app/assistant-media.ts";
import { fetchControlUiResource } from "../../app/browser-http.ts";

type ToolsInvokeResult = {
  ok: boolean;
  toolName?: string;
  output?: unknown;
  error?: { message?: string };
};

const AVATAR_SHEET_PROMPT = (name: string, creature: string, vibe: string) =>
  `Square 2x2 avatar choice sheet for an AI companion named "${name}". ` +
  `Four distinct portrait options in equal square tiles (top-left, top-right, bottom-left, bottom-right). ` +
  `Creature vibe: ${creature}. Mood: ${vibe}. ` +
  `Friendly, recognizable at small sizes, centered faces, soft lighting, no text, no borders, no gaps, no content crossing tile boundaries.`;

export type AvatarStudioStyle = {
  id: string;
  creature: string;
  vibe: string;
};

export const AVATAR_STUDIO_STYLES: readonly AvatarStudioStyle[] = [
  {
    id: "lobster",
    creature: "a charming lobster mascot",
    vibe: "warm, curious, and slightly mischievous",
  },
  { id: "fox", creature: "a clever fox companion", vibe: "sharp, playful, and trustworthy" },
  { id: "owl", creature: "a thoughtful owl guide", vibe: "calm, wise, and quietly funny" },
  { id: "robot", creature: "a friendly desk robot", vibe: "helpful, precise, and approachable" },
] as const;

type ImageGenerateListDetails = {
  providers?: Array<{ id?: string; configured?: boolean; ready?: boolean }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractAvatarStudioMediaPaths(output: unknown): string[] {
  const root = asRecord(output);
  const details = asRecord(root?.details) ?? root;
  if (!details) {
    return [];
  }
  const media = asRecord(details.media);
  const fromMedia = Array.isArray(media?.mediaUrls)
    ? media.mediaUrls.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
      )
    : [];
  const fromPaths = Array.isArray(details.paths)
    ? details.paths.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
      )
    : [];
  const attachments = Array.isArray(details.attachments) ? details.attachments : [];
  const fromAttachments = attachments
    .map((entry) => asRecord(entry)?.path)
    .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return [...new Set([...fromMedia, ...fromPaths, ...fromAttachments])];
}

function isImageProviderConfigured(provider: { configured?: boolean; ready?: boolean }): boolean {
  // Canonical list field is `configured`; tolerate legacy `ready` if present.
  return provider.configured === true || provider.ready === true;
}

export function isAvatarImageGenerationReady(details: ImageGenerateListDetails | null): boolean {
  return details?.providers?.some(isImageProviderConfigured) === true;
}

async function invokeImageTool(
  client: GatewayBrowserClient,
  args: Record<string, unknown>,
  agentId: string,
): Promise<ToolsInvokeResult> {
  return (await client.request("tools.invoke", {
    name: "image_generate",
    agentId,
    args,
  })) as ToolsInvokeResult;
}

/** Probe whether any image_generate provider is configured for this agent. */
export async function probeAvatarImageGeneration(
  client: GatewayBrowserClient,
  agentId: string,
): Promise<{ ready: boolean; message?: string }> {
  try {
    const result = await invokeImageTool(client, { action: "list" }, agentId);
    if (!result.ok) {
      return { ready: false, message: result.error?.message };
    }
    const details = (asRecord(result.output)?.details ??
      asRecord(result.output)) as ImageGenerateListDetails | null;
    const ready = isAvatarImageGenerationReady(details);
    return {
      ready,
      message: ready
        ? undefined
        : "No image model is ready yet. Connect Flux above, browse HF/CivitAI for local weights, or upload a portrait.",
    };
  } catch (error) {
    return {
      ready: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchGeneratedSheet(
  path: string,
  agentId: string,
  resourceBasePath: string,
  authToken?: string | null,
): Promise<Blob> {
  const url = buildAssistantMediaUrl(path, resourceBasePath, null, { agentId });
  const token = authToken?.trim();
  const response = await fetchControlUiResource(url, {
    credentials: "include",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  if (!response.ok) {
    throw new Error(`Could not load the generated sheet (${response.status}).`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(
      `Generated sheet URL returned ${contentType} instead of an image. ` +
        "Confirm Avatar Studio is using the Gateway resource base (not the Vite SPA fallback).",
    );
  }
  const blob = await response.blob();
  if (blob.type && !blob.type.startsWith("image/")) {
    throw new Error(
      `Generated sheet bytes look like ${blob.type}, not an image. Retry after refreshing the Control UI.`,
    );
  }
  return blob;
}

/** Generate a 2×2 avatar sheet and return the image blob. */
export async function generateAvatarChoiceSheet(params: {
  client: GatewayBrowserClient;
  agentId: string;
  name: string;
  style: AvatarStudioStyle;
  resourceBasePath?: string;
  authToken?: string | null;
}): Promise<Blob> {
  const result = await invokeImageTool(
    params.client,
    {
      prompt: AVATAR_SHEET_PROMPT(params.name, params.style.creature, params.style.vibe),
      count: 1,
      aspectRatio: "1:1",
    },
    params.agentId,
  );
  if (!result.ok) {
    throw new Error(result.error?.message || "Image generation failed.");
  }
  const paths = extractAvatarStudioMediaPaths(result.output);
  const path = paths[0];
  if (!path) {
    const details = asRecord(asRecord(result.output)?.details) ?? asRecord(result.output);
    if (details?.async === true || details?.status === "started") {
      throw new Error(
        "Image generation was accepted as a background task without returning a sheet. Retry after updating the Gateway, or upload a portrait instead.",
      );
    }
    throw new Error("Image generation finished without a usable image path.");
  }
  return fetchGeneratedSheet(path, params.agentId, params.resourceBasePath ?? "", params.authToken);
}
