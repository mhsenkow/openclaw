// Agent-specific English strings stay split from the oversized source locale.
export const agentChip = {
  menuLabel: "Agent menu",
  agents: "Agents",
  newConversation: "New conversation",
  allAgents: "All agents",
  showAllAgents: "Show all agents",
  showOneAgent: "Show one agent",
  workspaceMenuLabel: "Workspace menu",
  switchAgent: "Switch agent",
  working: "Working…",
  ready: "Ready to chat",
  whatCanAgentDo: "What can {name} do?",
  help: "Help",
  getHelp: "Get help",
  getApps: "Get the apps",
  discord: "Discord community",
  viewChangelog: "View changelog",
  agentSettings: "Agent settings",
};

export const agentScope = {
  label: "Agent",
  allAgents: "All agents",
};

export const pinning = {
  pinToSwitcher: "Pin to switcher",
  unpinFromSwitcher: "Unpin from switcher",
};

export const identity = {
  title: "Identity",
  subtitle: "Name, emoji, and avatar shown in chats and the sidebar.",
  name: "Display name",
  namePlaceholder: "Agent name",
  emoji: "Emoji",
  chooseImage: "Choose image…",
  replaceImage: "Replace image…",
  createAvatar: "Create avatar…",
  imageUnusable: "That image can't be used. Pick an image file up to 2 MB.",
  fileHint: "Saving mirrors identity fields to IDENTITY.md; configured values take precedence.",
};

export const avatarStudio = {
  title: "Create your avatar",
  subtitle: "Pick an image model, generate options, and save the face used in chat.",
  start: "Let’s go",
  introStep1: "Choose a look and a display name.",
  introStep2: "Connect a hosted Flux key, or browse Hugging Face / CivitAI models.",
  introStep3: "Generate four options (or upload one).",
  introStep4: "Pick a portrait — it saves to identity and reacts while the agent works.",
  introNote:
    "Hosted Flux is the fastest start. Hugging Face and CivitAI links help you grab local checkpoints for Comfy.",
  nameLabel: "Display name",
  styleLabel: "Look",
  providerTitle: "Image model",
  providerHint:
    "Connect a hosted Flux provider with an API key, or open Hugging Face / CivitAI to pick checkpoints for local Comfy.",
  cloudTitle: "Quick connect (hosted)",
  apiKeyLabel: "API key",
  apiKeyPlaceholder: "Paste API key",
  connectCloud: "Connect and continue",
  connecting: "Connecting…",
  getApiKey: "Get API key",
  browseTitle: "Browse Hugging Face & CivitAI",
  browseHint:
    "Open a model page to download into Comfy (or use it elsewhere). This Control UI does not pull multi‑GB weights itself yet.",
  catalogSearch: "Filter",
  catalogSearchPlaceholder: "flux, portrait, sdxl…",
  includeNsfw: "Show CivitAI NSFW / red listings",
  nsfwWarning:
    "Mature CivitAI listings stay opt-in. Your CivitAI account must also allow NSFW content.",
  catalogEmpty: "No catalog matches. Clear the filter or enable NSFW listings.",
  chooseProvider: "Choose an image model",
  skipToGenerate: "I already have a model — continue",
  generate: "Generate options",
  generating: "Generating…",
  generateHint: "This uses your configured image_generate provider to make a 2×2 choice sheet.",
  needProvider:
    "No image model is ready yet. Connect Flux above, browse HF/CivitAI for local weights, or upload a portrait.",
  openModelSetup: "Open full Model Setup",
  uploadInstead: "Upload a portrait instead…",
  pickHint: "Pick the portrait you want to keep.",
  pickLabel: "Avatar options",
  optionAlt: "Option {n}",
  save: "Save as avatar",
  done: "Saved. This avatar is now used in chat and the sidebar.",
  imageUnusable: "That image can't be used. Pick an image file up to 2 MB.",
  styles: {
    lobster: { label: "Lobster", hint: "Warm OpenClaw energy" },
    fox: { label: "Fox", hint: "Sharp and playful" },
    owl: { label: "Owl", hint: "Calm and thoughtful" },
    robot: { label: "Robot", hint: "Helpful desk companion" },
  },
};

export const avatarPresence = {
  createCtaTitle: "Give this agent a face",
  createCtaBody: "Create an avatar that shows up in chat and reacts while work is running.",
  createCtaAction: "Create avatar",
};
