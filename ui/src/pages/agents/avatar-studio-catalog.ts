// Curated Hugging Face + CivitAI image-model picks for Avatar Studio.
// These are browse/install targets — OpenClaw does not download multi-GB
// checkpoints into Comfy from the Control UI yet.

export type AvatarStudioCatalogSource = "huggingface" | "civitai" | "cloud";

export type AvatarStudioCatalogEntry = {
  id: string;
  source: AvatarStudioCatalogSource;
  /** Display name */
  label: string;
  /** One-line why it fits avatar work */
  hint: string;
  /** Open this URL to inspect / download */
  url: string;
  /** Cloud model ref when this maps to a ready image_generate provider */
  cloudModel?: string;
  /** Provider id for models.authSetApiKey when cloudModel is set */
  cloudProvider?: string;
  /** CivitAI / HF entries that are NSFW or “red” — only shown with opt-in */
  nsfw?: boolean;
  tags: readonly string[];
};

/** Fast hosted defaults users can connect with an API key. */
export const AVATAR_STUDIO_CLOUD_PROVIDERS = [
  {
    id: "fal-flux",
    label: "fal · Flux Dev",
    hint: "Fast hosted Flux. Paste a fal API key and go.",
    cloudProvider: "fal",
    cloudModel: "fal/fal-ai/flux/dev",
    keyHelpUrl: "https://fal.ai/dashboard/keys",
    tags: ["cloud", "flux", "fast"],
  },
  {
    id: "deepinfra-flux-schnell",
    label: "DeepInfra · FLUX.1 schnell",
    hint: "Very fast hosted Flux schnell. Good for quick avatar sheets.",
    cloudProvider: "deepinfra",
    cloudModel: "deepinfra/black-forest-labs/FLUX-1-schnell",
    keyHelpUrl: "https://deepinfra.com/dash/api_keys",
    tags: ["cloud", "flux", "schnell"],
  },
] as const;

/**
 * Browse catalog. Prefer well-known Flux / SDXL portrait models.
 * NSFW (“red”) CivitAI entries stay hidden until the operator opts in.
 */
export const AVATAR_STUDIO_BROWSE_CATALOG: readonly AvatarStudioCatalogEntry[] = [
  {
    id: "hf-flux-schnell",
    source: "huggingface",
    label: "FLUX.1 schnell",
    hint: "Black Forest Labs · fast local/cloud Flux on Hugging Face",
    url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell",
    tags: ["flux", "fast", "local"],
  },
  {
    id: "hf-flux-dev",
    source: "huggingface",
    label: "FLUX.1 dev",
    hint: "Higher quality Flux for detailed avatars",
    url: "https://huggingface.co/black-forest-labs/FLUX.1-dev",
    tags: ["flux", "quality", "local"],
  },
  {
    id: "hf-sdxl-base",
    source: "huggingface",
    label: "Stable Diffusion XL base",
    hint: "Classic SDXL checkpoint many Comfy workflows expect",
    url: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0",
    tags: ["sdxl", "local"],
  },
  {
    id: "civitai-flux-search",
    source: "civitai",
    label: "CivitAI · Flux checkpoints",
    hint: "Browse popular Flux checkpoints and LoRAs on CivitAI",
    url: "https://civitai.com/models?types=Checkpoint&baseModels=Flux.1%20S&baseModels=Flux.1%20D&sort=Highest%20Rated",
    tags: ["flux", "civitai", "browse"],
  },
  {
    id: "civitai-portrait",
    source: "civitai",
    label: "CivitAI · portrait / character",
    hint: "Portrait-oriented models good for avatar sheets",
    url: "https://civitai.com/search/models?sortBy=models_v9&query=portrait%20character",
    tags: ["portrait", "civitai", "browse"],
  },
  {
    id: "civitai-nsfw-flux",
    source: "civitai",
    label: "CivitAI · Flux (includes NSFW / red)",
    hint: "Same Flux browse with mature content visible — requires CivitAI account settings",
    url: "https://civitai.com/models?types=Checkpoint&baseModels=Flux.1%20S&baseModels=Flux.1%20D&sort=Highest%20Rated&nsfw=true",
    nsfw: true,
    tags: ["flux", "civitai", "nsfw", "red"],
  },
  {
    id: "civitai-nsfw-character",
    source: "civitai",
    label: "CivitAI · character (NSFW / red)",
    hint: "Character models including mature-rated listings",
    url: "https://civitai.com/search/models?sortBy=models_v9&query=character&nsfw=true",
    nsfw: true,
    tags: ["character", "civitai", "nsfw", "red"],
  },
  {
    id: "hf-search-flux",
    source: "huggingface",
    label: "Hugging Face · search Flux",
    hint: "Open HF model search filtered to text-to-image Flux",
    url: "https://huggingface.co/models?pipeline_tag=text-to-image&sort=downloads&search=flux",
    tags: ["flux", "browse"],
  },
] as const;

export function filterAvatarStudioCatalog(
  entries: readonly AvatarStudioCatalogEntry[],
  params: { query: string; includeNsfw: boolean },
): AvatarStudioCatalogEntry[] {
  const q = params.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (entry.nsfw && !params.includeNsfw) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = [entry.label, entry.hint, entry.source, ...entry.tags].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
