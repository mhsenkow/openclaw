import type { TranslationMap } from "../lib/types.ts";
import { en } from "./en.ts";

const enModelControls = {
  chat: {
    modelControls: {
      subscription: "Subscription",
      api: "API",
      default: "Default",
      effort: "Effort",
      faster: "Faster",
      smarter: "Smarter",
      fastMode: "Fast mode",
      searchModels: "Search models",
      noMatchingModels: "No models match your search",
      configureModels: "Configure models",
      selectionScopeSessionLabel: "This session",
      selectionScopeAgentLabel: "Agent default",
      selectionScopeGlobalLabel: "Global default",
      selectionScopeSession: "Selecting a model changes only this session.",
      selectionScopeAgent: "Selecting a model updates this agent's default.",
      selectionScopeGlobal: "Selecting a model updates the global default.",
      defaultWithModel: "Default ({model})",
      defaultWithLevel: "Default ({level})",
      fastHelp: "Faster responses, higher usage of limits.",
      contextWindow: "Context window",
      contextWindowAria: "Context window: {state}",
      speedUnsupported: "Speed control is not supported for this model.",
      contextActiveAndMax: "{active} active · {maximum} max",
      chatOnly: "Chat only",
      chatOnlyHelp:
        "This model can chat, but it cannot use tools. Choose another model for files, commands, web, or media tasks.",
      loadingModels: "Loading models…",
      modelPending: "Model pending",
      modelsUnavailable: "Models unavailable",
      runtimeUnavailable: "This harness is unavailable for this model.",
      modelsRefreshFailed: "Some models could not be refreshed. Open Models to try again.",
      checkingProviderModels: "{providers}: checking models…",
      noModelsAvailable: "No models available",
      emptyModelsAction: "Manage models",
      providerModels: "{provider} models",
      useDefaultReasoning: "Use default reasoning ({level})",
      fastResponsesAria: "Fast responses: {state}",
      chooseModel: "Choose a model",
      chooseModelHint: "Pick a tag to see what it is good for, then select it for this session.",
      closeChooser: "Close model chooser",
      detailEmptyTitle: "Hover a model",
      detailEmptyBody: "Benefits and limits show up here so you can compare before switching.",
      detailFallback: "No extra capability notes for this model yet.",
      detailTags: "Tags",
      benefitContextTitle: "Large context",
      benefitContextDetail: "Handles about {size} of conversation and file context.",
      benefitToolsTitle: "Tools",
      benefitToolsDetail: "Can use files, commands, web, and other agent tools.",
      benefitReasoningTitle: "Reasoning",
      benefitReasoningDetail: "Supports deeper thinking for harder multi-step work.",
      benefitLocalTitle: "Runs locally",
      benefitLocalDetail:
        "Stays on this machine — useful when you want offline or private inference.",
      benefitVisionTitle: "Vision",
      benefitVisionDetail: "Can take images or video as input.",
      benefitAudioTitle: "Audio",
      benefitAudioDetail: "Can take audio as input.",
      benefitDefaultDetail:
        "This is the configured default for new turns when nothing else is pinned.",
    },
  },
} satisfies TranslationMap;

export const registerModelControlsEnglish = Object.assign(
  () => {
    en.chat = Object.assign({}, en.chat, enModelControls.chat);
  },
  { catalog: enModelControls },
);
