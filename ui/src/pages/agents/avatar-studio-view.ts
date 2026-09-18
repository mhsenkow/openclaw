// Agents avatar studio: intro → style → image model → generate/pick → save.
import { html, nothing, type TemplateResult } from "lit";
import type { GatewayBrowserClient } from "../../api/gateway.ts";
import { t } from "../../i18n/index.ts";
import { formatUiError } from "../../lib/format-error.ts";
import "../../components/modal-dialog.ts";
import {
  AVATAR_STUDIO_BROWSE_CATALOG,
  AVATAR_STUDIO_CLOUD_PROVIDERS,
  filterAvatarStudioCatalog,
} from "./avatar-studio-catalog.ts";
import {
  AVATAR_STUDIO_STYLES,
  generateAvatarChoiceSheet,
  probeAvatarImageGeneration,
  type AvatarStudioStyle,
} from "./avatar-studio-generate.ts";
import {
  cropAvatarSheetQuadrants,
  encodeAvatarPortrait,
  type AvatarSheetQuadrant,
} from "./avatar-studio-sheet.ts";
import "../../styles/avatar-studio.css";

export type AvatarStudioPhase =
  | "intro"
  | "style"
  | "provider"
  | "generate"
  | "pick"
  | "saving"
  | "done"
  | "error";

export type AvatarStudioState = {
  open: boolean;
  phase: AvatarStudioPhase;
  styleId: string;
  name: string;
  sheetUrl: string | null;
  options: Array<string | null>;
  selected: AvatarSheetQuadrant | null;
  busy: boolean;
  error: string | null;
  generationReady: boolean | null;
  generationHint: string | null;
  catalogQuery: string;
  includeNsfw: boolean;
  cloudProviderId: string;
  apiKeyDraft: string;
};

export function createAvatarStudioState(name = ""): AvatarStudioState {
  return {
    open: false,
    phase: "intro",
    styleId: AVATAR_STUDIO_STYLES[0]?.id ?? "lobster",
    name,
    sheetUrl: null,
    options: [],
    selected: null,
    busy: false,
    error: null,
    generationReady: null,
    generationHint: null,
    catalogQuery: "",
    includeNsfw: false,
    cloudProviderId: AVATAR_STUDIO_CLOUD_PROVIDERS[0]?.id ?? "fal-flux",
    apiKeyDraft: "",
  };
}

function revokeSheet(state: AvatarStudioState) {
  if (state.sheetUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(state.sheetUrl);
  }
}

export function closeAvatarStudio(state: AvatarStudioState): AvatarStudioState {
  revokeSheet(state);
  return { ...createAvatarStudioState(state.name), open: false };
}

export function openAvatarStudio(state: AvatarStudioState, name: string): AvatarStudioState {
  revokeSheet(state);
  return { ...createAvatarStudioState(name), open: true, phase: "intro" };
}

function selectedStyle(state: AvatarStudioState): AvatarStudioStyle {
  return (
    AVATAR_STUDIO_STYLES.find((entry) => entry.id === state.styleId) ?? AVATAR_STUDIO_STYLES[0]!
  );
}

export function selectedCloudProvider(state: AvatarStudioState) {
  return (
    AVATAR_STUDIO_CLOUD_PROVIDERS.find((entry) => entry.id === state.cloudProviderId) ??
    AVATAR_STUDIO_CLOUD_PROVIDERS[0]!
  );
}

/** After the style step: probe readiness and route to provider or generate. */
export async function prepareAvatarStudioGeneration(
  state: AvatarStudioState,
  client: GatewayBrowserClient,
  agentId: string,
): Promise<AvatarStudioState> {
  const probe = await probeAvatarImageGeneration(client, agentId);
  return {
    ...state,
    phase: probe.ready ? "generate" : "provider",
    generationReady: probe.ready,
    generationHint: probe.message ?? null,
    error: null,
  };
}

export async function refreshAvatarStudioProviderReady(
  state: AvatarStudioState,
  client: GatewayBrowserClient,
  agentId: string,
): Promise<AvatarStudioState> {
  const probe = await probeAvatarImageGeneration(client, agentId);
  return {
    ...state,
    generationReady: probe.ready,
    generationHint: probe.message ?? null,
    phase: probe.ready ? "generate" : state.phase,
    error: probe.ready ? null : (probe.message ?? state.error),
  };
}

export async function runAvatarStudioGeneration(params: {
  state: AvatarStudioState;
  client: GatewayBrowserClient;
  agentId: string;
  resourceBasePath?: string;
  authToken?: string | null;
}): Promise<AvatarStudioState> {
  const { state } = params;
  revokeSheet(state);
  try {
    const blob = await generateAvatarChoiceSheet({
      client: params.client,
      agentId: params.agentId,
      name: state.name.trim() || "Companion",
      style: selectedStyle(state),
      resourceBasePath: params.resourceBasePath,
      authToken: params.authToken,
    });
    const options = await cropAvatarSheetQuadrants(blob);
    if (!options.some(Boolean)) {
      throw new Error("Could not crop portraits from the generated sheet.");
    }
    return {
      ...state,
      phase: "pick",
      busy: false,
      error: null,
      sheetUrl: URL.createObjectURL(blob),
      options,
      selected: null,
    };
  } catch (error) {
    return {
      ...state,
      phase: "generate",
      busy: false,
      error: formatUiError(error),
      sheetUrl: null,
      options: [],
      selected: null,
    };
  }
}

export async function importAvatarStudioPortrait(
  state: AvatarStudioState,
  file: File,
): Promise<AvatarStudioState> {
  const encoded = await encodeAvatarPortrait(file);
  if (!encoded) {
    return {
      ...state,
      error: t("agents.avatarStudio.imageUnusable"),
    };
  }
  revokeSheet(state);
  return {
    ...state,
    phase: "pick",
    error: null,
    sheetUrl: encoded,
    options: [encoded, null, null, null],
    selected: 0,
  };
}

function renderProviderStep(props: {
  state: AvatarStudioState;
  onCloudProvider: (id: string) => void;
  onApiKey: (value: string) => void;
  onConnectCloud: () => void;
  onCatalogQuery: (value: string) => void;
  onToggleNsfw: (enabled: boolean) => void;
  onOpenModelSetup: () => void;
}): TemplateResult {
  const { state } = props;
  const catalog = filterAvatarStudioCatalog(AVATAR_STUDIO_BROWSE_CATALOG, {
    query: state.catalogQuery,
    includeNsfw: state.includeNsfw,
  });
  return html`
    <section class="avatar-studio__provider">
      <h3>${t("agents.avatarStudio.providerTitle")}</h3>
      <p class="avatar-studio__note">${t("agents.avatarStudio.providerHint")}</p>

      <div class="avatar-studio__cloud">
        <h4>${t("agents.avatarStudio.cloudTitle")}</h4>
        <div
          class="avatar-studio__styles"
          role="radiogroup"
          aria-label=${t("agents.avatarStudio.cloudTitle")}
        >
          ${AVATAR_STUDIO_CLOUD_PROVIDERS.map(
            (provider) => html`
              <button
                type="button"
                class="avatar-studio__style ${state.cloudProviderId === provider.id ? "is-selected" : ""}"
                role="radio"
                aria-checked=${String(state.cloudProviderId === provider.id)}
                ?disabled=${state.busy}
                @click=${() => props.onCloudProvider(provider.id)}
              >
                <strong>${provider.label}</strong>
                <span>${provider.hint}</span>
              </button>
            `,
          )}
        </div>
        <label class="field">
          <span>${t("agents.avatarStudio.apiKeyLabel")}</span>
          <input
            type="password"
            autocomplete="off"
            spellcheck="false"
            .value=${state.apiKeyDraft}
            ?disabled=${state.busy}
            placeholder=${t("agents.avatarStudio.apiKeyPlaceholder")}
            @input=${(event: Event) => props.onApiKey((event.target as HTMLInputElement).value)}
          />
        </label>
        <div class="avatar-studio__provider-actions">
          <button
            type="button"
            class="btn primary"
            ?disabled=${state.busy || !state.apiKeyDraft.trim()}
            @click=${props.onConnectCloud}
          >
            ${state.busy ? t("agents.avatarStudio.connecting") : t("agents.avatarStudio.connectCloud")}
          </button>
          <a
            class="btn"
            href=${selectedCloudProvider(state).keyHelpUrl}
            target="_blank"
            rel="noreferrer"
          >
            ${t("agents.avatarStudio.getApiKey")}
          </a>
        </div>
      </div>

      <div class="avatar-studio__browse">
        <h4>${t("agents.avatarStudio.browseTitle")}</h4>
        <p class="avatar-studio__note">${t("agents.avatarStudio.browseHint")}</p>
        <label class="field">
          <span>${t("agents.avatarStudio.catalogSearch")}</span>
          <input
            type="search"
            .value=${state.catalogQuery}
            ?disabled=${state.busy}
            placeholder=${t("agents.avatarStudio.catalogSearchPlaceholder")}
            @input=${(event: Event) =>
              props.onCatalogQuery((event.target as HTMLInputElement).value)}
          />
        </label>
        <label class="avatar-studio__nsfw">
          <input
            type="checkbox"
            .checked=${state.includeNsfw}
            ?disabled=${state.busy}
            @change=${(event: Event) =>
              props.onToggleNsfw((event.target as HTMLInputElement).checked)}
          />
          <span>${t("agents.avatarStudio.includeNsfw")}</span>
        </label>
        ${
          state.includeNsfw
            ? html`<p class="avatar-studio__note avatar-studio__note--warn" role="note">
                ${t("agents.avatarStudio.nsfwWarning")}
              </p>`
            : nothing
        }
        <div class="avatar-studio__catalog">
          ${
            catalog.length === 0
              ? html`<p class="avatar-studio__note">${t("agents.avatarStudio.catalogEmpty")}</p>`
              : catalog.map(
                  (entry) => html`
                    <a
                      class="avatar-studio__catalog-card ${entry.nsfw ? "avatar-studio__catalog-card--nsfw" : ""}"
                      href=${entry.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>${entry.label}</strong>
                      <span class="avatar-studio__catalog-source">${entry.source}</span>
                      <span>${entry.hint}</span>
                    </a>
                  `,
                )
          }
        </div>
      </div>

      <button type="button" class="btn btn--sm" @click=${props.onOpenModelSetup}>
        ${t("agents.avatarStudio.openModelSetup")}
      </button>
    </section>
  `;
}

export function renderAvatarStudio(props: {
  state: AvatarStudioState;
  onClose: () => void;
  onPhase: (phase: AvatarStudioPhase) => void;
  onStyle: (styleId: string) => void;
  onName: (name: string) => void;
  onPrepareGenerate: () => void;
  onGenerate: () => void;
  onImport: (file: File) => void;
  onSelect: (quadrant: AvatarSheetQuadrant) => void;
  onSave: () => void;
  onOpenModelSetup: () => void;
  onCloudProvider: (id: string) => void;
  onApiKey: (value: string) => void;
  onConnectCloud: () => void;
  onCatalogQuery: (value: string) => void;
  onToggleNsfw: (enabled: boolean) => void;
  onOpenProvider: () => void;
}): TemplateResult | typeof nothing {
  const { state } = props;
  if (!state.open) {
    return nothing;
  }
  return html`
    <openclaw-modal-dialog
      class="avatar-studio"
      label=${t("agents.avatarStudio.title")}
      .lightDismiss=${!state.busy}
      @modal-cancel=${() => {
        if (!state.busy) {
          props.onClose();
        }
      }}
    >
      <div class="avatar-studio__shell">
        <header class="avatar-studio__header">
          <h2>${t("agents.avatarStudio.title")}</h2>
          <p>${t("agents.avatarStudio.subtitle")}</p>
        </header>
        <div class="avatar-studio__body">
          ${
            state.phase === "intro"
              ? html`
                  <ol class="avatar-studio__steps">
                    <li>${t("agents.avatarStudio.introStep1")}</li>
                    <li>${t("agents.avatarStudio.introStep2")}</li>
                    <li>${t("agents.avatarStudio.introStep3")}</li>
                    <li>${t("agents.avatarStudio.introStep4")}</li>
                  </ol>
                  <p class="avatar-studio__note">${t("agents.avatarStudio.introNote")}</p>
                `
              : nothing
          }
          ${
            state.phase === "style"
              ? html`
                  <label class="field">
                    <span>${t("agents.avatarStudio.nameLabel")}</span>
                    <input
                      type="text"
                      maxlength="64"
                      .value=${state.name}
                      ?disabled=${state.busy}
                      @input=${(event: Event) =>
                        props.onName((event.target as HTMLInputElement).value)}
                    />
                  </label>
                  <div
                    class="avatar-studio__styles"
                    role="radiogroup"
                    aria-label=${t("agents.avatarStudio.styleLabel")}
                  >
                    ${AVATAR_STUDIO_STYLES.map(
                      (style) => html`
                        <button
                          type="button"
                          class="avatar-studio__style ${state.styleId === style.id ? "is-selected" : ""}"
                          role="radio"
                          aria-checked=${String(state.styleId === style.id)}
                          ?disabled=${state.busy}
                          @click=${() => props.onStyle(style.id)}
                        >
                          <strong>${t(`agents.avatarStudio.styles.${style.id}.label`)}</strong>
                          <span>${t(`agents.avatarStudio.styles.${style.id}.hint`)}</span>
                        </button>
                      `,
                    )}
                  </div>
                `
              : nothing
          }
          ${
            state.phase === "provider"
              ? renderProviderStep({
                  state,
                  onCloudProvider: props.onCloudProvider,
                  onApiKey: props.onApiKey,
                  onConnectCloud: props.onConnectCloud,
                  onCatalogQuery: props.onCatalogQuery,
                  onToggleNsfw: props.onToggleNsfw,
                  onOpenModelSetup: props.onOpenModelSetup,
                })
              : nothing
          }
          ${
            state.phase === "generate"
              ? html`
                  ${
                    state.generationReady === false
                      ? html`<div class="callout warning" role="status">
                          <p>${state.generationHint ?? t("agents.avatarStudio.needProvider")}</p>
                          <button type="button" class="btn btn--sm" @click=${props.onOpenProvider}>
                            ${t("agents.avatarStudio.chooseProvider")}
                          </button>
                        </div>`
                      : html`<p>${t("agents.avatarStudio.generateHint")}</p>`
                  }
                  <div class="avatar-studio__import">
                    <label class="btn">
                      ${t("agents.avatarStudio.uploadInstead")}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        ?disabled=${state.busy}
                        @change=${(event: Event) => {
                          const input = event.target as HTMLInputElement;
                          const file = input.files?.[0];
                          input.value = "";
                          if (file) {
                            props.onImport(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                `
              : nothing
          }
          ${
            state.phase === "pick"
              ? html`
                  <p>${t("agents.avatarStudio.pickHint")}</p>
                  <div
                    class="avatar-studio__grid"
                    role="listbox"
                    aria-label=${t("agents.avatarStudio.pickLabel")}
                  >
                    ${state.options.map((option, index) =>
                      option
                        ? html`<button
                            type="button"
                            class="avatar-studio__option ${state.selected === index ? "is-selected" : ""}"
                            role="option"
                            aria-selected=${String(state.selected === index)}
                            @click=${() => props.onSelect(index as AvatarSheetQuadrant)}
                          >
                            <img
                              src=${option}
                              alt=${t("agents.avatarStudio.optionAlt", { n: String(index + 1) })}
                            />
                          </button>`
                        : nothing,
                    )}
                  </div>
                `
              : nothing
          }
          ${
            state.phase === "done"
              ? html`<div class="callout success" role="status">
                  ${t("agents.avatarStudio.done")}
                </div>`
              : nothing
          }
          ${
            state.error
              ? html`<div class="callout danger" role="alert">${state.error}</div>`
              : nothing
          }
        </div>
        <footer class="avatar-studio__footer">
          <button type="button" class="btn" ?disabled=${state.busy} @click=${props.onClose}>
            ${state.phase === "done" ? t("common.close") : t("common.cancel")}
          </button>
          ${
            state.phase === "intro"
              ? html`<button
                  type="button"
                  class="btn primary"
                  @click=${() => props.onPhase("style")}
                >
                  ${t("agents.avatarStudio.start")}
                </button>`
              : nothing
          }
          ${
            state.phase === "style"
              ? html`<button
                  type="button"
                  class="btn primary"
                  ?disabled=${!state.name.trim()}
                  @click=${props.onPrepareGenerate}
                >
                  ${t("common.continue")}
                </button>`
              : nothing
          }
          ${
            state.phase === "provider"
              ? html`<button
                  type="button"
                  class="btn"
                  ?disabled=${state.busy}
                  @click=${() => props.onPhase("generate")}
                >
                  ${t("agents.avatarStudio.skipToGenerate")}
                </button>`
              : nothing
          }
          ${
            state.phase === "generate"
              ? html`<button
                  type="button"
                  class="btn primary"
                  ?disabled=${state.busy || state.generationReady === false}
                  @click=${props.onGenerate}
                >
                  ${state.busy ? t("agents.avatarStudio.generating") : t("agents.avatarStudio.generate")}
                </button>`
              : nothing
          }
          ${
            state.phase === "pick"
              ? html`<button
                  type="button"
                  class="btn primary"
                  ?disabled=${state.busy || state.selected === null}
                  @click=${props.onSave}
                >
                  ${state.busy ? t("common.saving") : t("agents.avatarStudio.save")}
                </button>`
              : nothing
          }
        </footer>
      </div>
    </openclaw-modal-dialog>
  `;
}
