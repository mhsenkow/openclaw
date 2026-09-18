import { html, nothing, render as renderTo } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../../../components/icons.ts";
import "../../../components/modal-dialog.ts";
import "../../../components/tooltip.ts";
import {
  hasProviderBrandIcon,
  providerDisplayLabel,
  renderProviderBrandIcon,
} from "../../../components/provider-icon.ts";
import { t } from "../../../i18n/index.ts";
import { registerModelControlsEnglish } from "../../../i18n/locales/en-model-controls.ts";
import type { ModelProviderAuthLabel as ChatModelProviderAuth } from "../../../lib/model-provider-auth-label.ts";
import "../../../styles/chat/model-picker-modal.css";
import {
  type ChatContextWindowControlParams,
  renderContextWindowControl,
} from "./chat-context-window-control.ts";
import type { ChatModelAccountSection } from "./chat-model-account-control.ts";
import {
  type ChatModelCatalogState,
  renderChatModelCatalogState,
} from "./chat-model-catalog-state.ts";
import { renderModelPickerDetail } from "./chat-model-picker-benefits.ts";
import {
  formatModelLabel,
  isModelPickerOptionSelected,
  modelPickerOptionKey,
  renderChatModelPickerTag,
  renderChatModelPickerTargetOption,
  renderChatModelProviderIcon,
  type ChatModelPickerOption,
  type ChatModelPickerTargetGroup,
} from "./chat-model-picker-options.ts";
import {
  handleModelPickerKeydown,
  handleModelSearchKeydown,
  highlightModelRow,
  pickerMenu,
  resetModelSearch,
  syncChatModelSearch,
  updateModelSearch,
} from "./chat-model-picker-search.ts";
import { handleChatComposerDetailsToggle, syncChatPickerOverlay } from "./chat-picker-overlay.ts";

registerModelControlsEnglish();

export type { ChatModelCatalogState } from "./chat-model-catalog-state.ts";

export type { ModelProviderAuthLabel as ChatModelProviderAuth } from "../../../lib/model-provider-auth-label.ts";

/** Session-scoped hover/focus preview for the modal detail pane. */
const modelPickerPreviewKeys = new Map<string, string>();
const MODEL_PICKER_PORTAL_ID = "openclaw-chat-model-picker-portal";
let retainedModelSearchQuery = "";

function syncModelPickerPortal(content: ReturnType<typeof html> | typeof nothing) {
  const existing = document.getElementById(MODEL_PICKER_PORTAL_ID);
  if (content === nothing) {
    if (existing) {
      retainedModelSearchQuery =
        existing.querySelector<HTMLInputElement>("[data-chat-model-search]")?.value ?? "";
      renderTo(nothing, existing);
      existing.remove();
    }
    document.getElementById("debug-modal-test")?.remove();
    return;
  }
  let host = existing;
  if (!host) {
    host = document.createElement("div");
    host.id = MODEL_PICKER_PORTAL_ID;
    document.body.appendChild(host);
  }
  const prior = host.querySelector<HTMLInputElement>("[data-chat-model-search]");
  const priorQuery = prior?.value || retainedModelSearchQuery;
  const priorSelection =
    prior && document.activeElement === prior
      ? ([prior.selectionStart, prior.selectionEnd] as const)
      : null;
  const hadFocus = prior != null && document.activeElement === prior;
  renderTo(content, host);
  retainedModelSearchQuery = "";
  const next = host.querySelector<HTMLInputElement>("[data-chat-model-search]");
  if (next && priorQuery) {
    next.value = priorQuery;
    updateModelSearch(next, true);
    if (hadFocus) {
      next.focus({ preventScroll: true });
      if (priorSelection) {
        next.setSelectionRange(
          priorSelection[0] ?? priorQuery.length,
          priorSelection[1] ?? priorQuery.length,
        );
      }
    }
  }
}

type ChatModelPickerParams = {
  providerAuth?: ReadonlyMap<string, ChatModelProviderAuth>;
  accountSection?: ChatModelAccountSection;
  contextWindow?: ChatContextWindowControlParams;
  disabled: boolean;
  disabledReason?: string;
  modelCatalogState?: ChatModelCatalogState;
  modelSelectionLocked: boolean;
  selectionScopeDescription?: string;
  modelOptions: ChatModelPickerOption[];
  open?: boolean;
  targetGroups?: readonly ChatModelPickerTargetGroup[];
  selectedModelValue: string;
  selectedAgentRuntime?: string;
  /** Pin recorded on the session row; only then does an unavailable Default row reset. */
  sessionModelPinned: boolean;
  sessionKey: string;
  triggerModelLabel: string;
  triggerModelValue?: string;
  triggerStatusLabel?: string;
  triggerLoading?: boolean;
  onModelSetup?: () => void;
  onOpen?: () => unknown;
  onOpenChange?: (open: boolean) => void;
  onModelSelect: (
    value: string,
    sessionKey: string,
    agentRuntime?: string | null,
  ) => Promise<unknown>;
  onTargetRetry?: (groupId: string) => unknown;
  onTargetSelect?: (groupId: string, value: string) => unknown;
  onRequestUpdate?: () => void;
};

export function renderChatModelPicker(params: ChatModelPickerParams) {
  const defaultModelOption = params.modelOptions.find((option) => option.isDefault);
  const activeModelOption = params.modelOptions.find((option) =>
    isModelPickerOptionSelected(option, params.selectedModelValue, params.selectedAgentRuntime),
  );
  const triggerModelValue = params.triggerModelValue;
  const triggerModelOption =
    triggerModelValue === undefined
      ? activeModelOption
      : triggerModelValue === ""
        ? undefined
        : params.modelOptions.find((option) =>
            isModelPickerOptionSelected(option, triggerModelValue, params.selectedAgentRuntime),
          );
  const modelToolsUnavailable = triggerModelOption?.supportsTools === false;
  const selectedContextWindowOption = params.contextWindow?.options.find(
    (option) => option.id === params.contextWindow?.selected,
  );
  const showContextWindowBadge =
    selectedContextWindowOption !== undefined &&
    params.contextWindow?.selected !== params.contextWindow?.defaultId;
  const triggerTitle = [
    params.triggerStatusLabel ?? params.triggerModelLabel,
    modelToolsUnavailable ? t("chat.modelControls.chatOnly") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const triggerProviderIcon =
    !params.triggerLoading &&
    !params.triggerStatusLabel &&
    triggerModelOption &&
    hasProviderBrandIcon(triggerModelOption.provider)
      ? renderProviderBrandIcon(triggerModelOption.provider, {
          className: "chat-controls__trigger-provider-icon",
        })
      : nothing;
  const providerGroups = new Map<string, ChatModelPickerOption[]>();
  for (const option of params.modelOptions) {
    const existing = providerGroups.get(option.provider);
    if (existing) {
      if (option.isDefault) {
        existing.unshift(option);
      } else {
        existing.push(option);
      }
    } else {
      providerGroups.set(option.provider, [option]);
    }
  }
  const orderedProviderGroups = [...providerGroups];
  const defaultProviderIndex = orderedProviderGroups.findIndex(
    ([provider]) => provider === defaultModelOption?.provider,
  );
  if (defaultProviderIndex > 0) {
    const [defaultGroup] = orderedProviderGroups.splice(defaultProviderIndex, 1);
    if (defaultGroup) {
      orderedProviderGroups.unshift(defaultGroup);
    }
  }
  const orderedOptions = orderedProviderGroups.flatMap(([, options]) => options);
  const optionIndex = new Map(
    orderedOptions.map((option, index) => [modelPickerOptionKey(option), index]),
  );
  const targetGroups = params.targetGroups ?? [];
  const targetOptionCount = targetGroups.reduce((count, group) => count + group.options.length, 0);
  const hasOptions =
    params.modelOptions.length + targetOptionCount > 0 ||
    targetGroups.some((group) => group.status !== "ready");
  const hasSelectableModelOptions = params.modelOptions.some((option) => !option.disabled);
  const selectedKey = activeModelOption ? modelPickerOptionKey(activeModelOption) : "";
  if (params.open && !modelPickerPreviewKeys.has(params.sessionKey) && selectedKey) {
    modelPickerPreviewKeys.set(params.sessionKey, selectedKey);
  }
  if (!params.open) {
    modelPickerPreviewKeys.delete(params.sessionKey);
    retainedModelSearchQuery = "";
  }
  const previewKey = modelPickerPreviewKeys.get(params.sessionKey) ?? selectedKey;
  const previewOption =
    orderedOptions.find((option) => modelPickerOptionKey(option) === previewKey) ??
    activeModelOption;
  const closePicker = (details?: HTMLDetailsElement | null) => {
    modelPickerPreviewKeys.delete(params.sessionKey);
    const target =
      details ??
      document.querySelector<HTMLDetailsElement>("details.chat-controls__model-picker[open]");
    if (target) {
      target.open = false;
    }
    params.onOpenChange?.(false);
    params.onRequestUpdate?.();
  };
  const openModelSetup = () => {
    // Navigate first, then tear down the portal — closing first dropped setup.
    params.onModelSetup?.();
    closePicker();
  };
  const commitModel = (entry: ChatModelPickerOption) => {
    if (params.modelSelectionLocked) {
      return;
    }
    void params
      .onModelSelect(entry.commitValue, params.sessionKey, entry.runtimeOverride ?? null)
      .finally(() => params.onRequestUpdate?.());
    params.onRequestUpdate?.();
  };
  const selectModel = (entry: ChatModelPickerOption, event: MouseEvent) => {
    event.stopPropagation();
    const resetsPin = entry.isDefault && params.sessionModelPinned;
    if (params.disabled || params.modelSelectionLocked || (entry.disabled && !resetsPin)) {
      event.preventDefault();
      return;
    }
    commitModel(entry);
    const details = (event.currentTarget as HTMLElement).closest<HTMLDetailsElement>("details");
    closePicker(details);
    if (event.detail === 0) {
      details?.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    }
  };
  const selectTarget = (groupId: string, value: string, event: MouseEvent) => {
    event.stopPropagation();
    if (params.disabled || params.modelSelectionLocked) {
      event.preventDefault();
      return;
    }
    params.onTargetSelect?.(groupId, value);
    const details = (event.currentTarget as HTMLElement).closest<HTMLDetailsElement>("details");
    closePicker(details);
    if (event.detail === 0) {
      details?.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    }
  };
  const highlightOption = (row: HTMLButtonElement) => {
    const menu = pickerMenu(row);
    if (menu) {
      highlightModelRow(menu, row);
    }
    const value = row.dataset.chatModelOption ?? "";
    const runtime = row.dataset.chatModelRuntime;
    const match = orderedOptions.find(
      (option) =>
        option.value === value &&
        (runtime
          ? (option.agentRuntime ?? "") === runtime
          : option.agentRuntime === undefined || option.agentRuntime === null),
    );
    if (match) {
      modelPickerPreviewKeys.set(params.sessionKey, modelPickerOptionKey(match));
      params.onRequestUpdate?.();
    }
  };
  const modalTemplate = params.open
    ? html`
        <openclaw-modal-dialog
          class="chat-model-picker-modal"
          label=${t("chat.modelControls.chooseModel")}
          .lightDismiss=${false}
          @modal-cancel=${() => {
            closePicker(
              document.querySelector<HTMLDetailsElement>(
                "details.chat-controls__model-picker[open]",
              ),
            );
          }}
        >
          <div
            class="chat-controls__inline-select-menu chat-controls__model-menu chat-controls__model-menu--modal chat-model-picker-modal__shell"
            aria-label=${t("chat.selectors.model")}
          >
            <header class="chat-model-picker-modal__header">
              <div class="chat-model-picker-modal__header-row">
                <h2 class="chat-model-picker-modal__title">
                  ${t("chat.modelControls.chooseModel")}
                </h2>
                <button
                  type="button"
                  class="chat-model-picker-modal__close"
                  aria-label=${t("chat.modelControls.closeChooser")}
                  @click=${() => closePicker()}
                >
                  ${icons.x}
                </button>
              </div>
              <p class="chat-model-picker-modal__hint">
                ${params.selectionScopeDescription || t("chat.modelControls.chooseModelHint")}
              </p>
            </header>
            ${
              params.modelSelectionLocked
                ? html`
                    <div
                      class="chat-controls__locked-model"
                      aria-label=${t("chat.selectors.modelLockedLabel")}
                    >
                      <span class="chat-controls__inline-select-section-label">
                        ${t("chat.selectors.modelSection")}
                      </span>
                      <span class="chat-controls__locked-model-value"
                        >${params.triggerModelLabel}</span
                      >
                      <span class="chat-controls__locked-model-badge">
                        ${t("chat.selectors.modelLocked")}
                      </span>
                    </div>
                  `
                : html`
                    ${
                      hasOptions || params.accountSection
                        ? html`
                            <div
                              class="chat-model-picker-modal__search chat-controls__model-search-wrap"
                            >
                              ${icons.search}
                              <input
                                class="chat-controls__model-search"
                                data-chat-model-search="true"
                                type="search"
                                role="combobox"
                                aria-autocomplete="list"
                                autocomplete="off"
                                spellcheck="false"
                                placeholder=${t("chat.modelControls.searchModels")}
                                aria-label=${t("chat.modelControls.searchModels")}
                                ?disabled=${params.disabled}
                                @input=${(event: InputEvent) =>
                                  updateModelSearch(event.currentTarget as HTMLInputElement)}
                                @keydown=${handleModelSearchKeydown}
                              />
                            </div>
                          `
                        : nothing
                    }
                    <div class="chat-model-picker-modal__body">
                      <div class="chat-model-picker-modal__catalog">
                        ${renderChatModelCatalogState(
                          params.modelCatalogState,
                          params.modelOptions.length > 0,
                          hasSelectableModelOptions,
                          params.onModelSetup ? openModelSetup : undefined,
                        )}
                        ${
                          hasOptions || params.accountSection
                            ? html`
                                <div class="chat-controls__model-options">
                                  ${repeat(
                                    orderedProviderGroups,
                                    ([provider]) => provider,
                                    ([provider, options]) => {
                                      const auth = params.providerAuth?.get(provider);
                                      const showAuth =
                                        auth &&
                                        !(
                                          auth.kind === "missing" &&
                                          options.some(
                                            (option) =>
                                              option.disabled &&
                                              (option.unavailableReason === "missing-auth" ||
                                                option.unavailableReason === "auth-failed"),
                                          )
                                        );
                                      const authLabel = showAuth
                                        ? [auth.label, auth.detail].filter(Boolean).join(" · ")
                                        : undefined;
                                      return html`
                                        <section
                                          class="chat-controls__provider-model-group chat-controls__provider-model-group--tags"
                                          data-chat-model-provider-group=${provider}
                                          aria-label=${t("chat.modelControls.providerModels", {
                                            provider: providerDisplayLabel(provider),
                                          })}
                                        >
                                          <div
                                            class="chat-controls__provider-heading"
                                            data-chat-model-provider=${provider}
                                            title=${authLabel ?? nothing}
                                          >
                                            ${renderChatModelProviderIcon(provider)}
                                            <span class="chat-controls__provider-label"
                                              >${providerDisplayLabel(provider)}</span
                                            >
                                            ${
                                              showAuth
                                                ? html`<span
                                                    class="chat-controls__auth-meta"
                                                    data-auth-kind=${auth.kind}
                                                    ><span aria-hidden="true"
                                                      >${
                                                        auth.kind === "subscription"
                                                          ? icons.circleUser
                                                          : auth.kind === "api"
                                                            ? icons.key
                                                            : icons.alertTriangle
                                                      }</span
                                                    ><span class="chat-controls__auth-meta-label"
                                                      >${authLabel}</span
                                                    ></span
                                                  >`
                                                : nothing
                                            }
                                            ${
                                              params.onModelSetup
                                                ? html`<button
                                                    class="chat-controls__provider-settings"
                                                    data-chat-model-provider-settings
                                                    type="button"
                                                    aria-label=${t(
                                                      "chat.modelControls.configureModels",
                                                    )}
                                                    @click=${(event: MouseEvent) => {
                                                      event.preventDefault();
                                                      event.stopPropagation();
                                                      openModelSetup();
                                                    }}
                                                    @pointerdown=${(event: PointerEvent) => {
                                                      event.stopPropagation();
                                                    }}
                                                  >
                                                    ${icons.settings}
                                                  </button>`
                                                : nothing
                                            }
                                          </div>
                                          <div
                                            class="chat-model-picker-tags chat-controls__provider-model-list"
                                            data-chat-model-list="true"
                                            role="listbox"
                                            aria-label=${t("chat.modelControls.providerModels", {
                                              provider: providerDisplayLabel(provider),
                                            })}
                                          >
                                            ${repeat(options, modelPickerOptionKey, (entry) =>
                                              renderChatModelPickerTag({
                                                disabled: params.disabled,
                                                entry,
                                                index:
                                                  optionIndex.get(modelPickerOptionKey(entry)) ?? 0,
                                                selectedModelValue: params.selectedModelValue,
                                                selectedAgentRuntime: params.selectedAgentRuntime,
                                                sessionModelPinned: params.sessionModelPinned,
                                                previewed:
                                                  modelPickerOptionKey(entry) === previewKey,
                                                onHighlight: highlightOption,
                                                onSelect: selectModel,
                                                onModelSetup: params.onModelSetup
                                                  ? openModelSetup
                                                  : undefined,
                                              }),
                                            )}
                                          </div>
                                        </section>
                                      `;
                                    },
                                  )}
                                  ${repeat(
                                    targetGroups,
                                    (group) => group.id,
                                    (group) => html`
                                      <section
                                        class="chat-controls__provider-model-group chat-controls__provider-model-group--tags"
                                        data-chat-model-target-group=${group.id}
                                        aria-label=${group.label}
                                      >
                                        <div class="chat-controls__provider-heading">
                                          <span
                                            class="chat-controls__provider-icon chat-controls__target-icon"
                                            aria-hidden="true"
                                            >${icons.terminal}</span
                                          >
                                          <span>${group.label}</span>
                                        </div>
                                        ${
                                          group.status === "ready"
                                            ? nothing
                                            : renderChatModelCatalogState(
                                                { hasSnapshot: false, status: group.status },
                                                false,
                                                false,
                                                undefined,
                                                group.errorLabel,
                                                params.onTargetRetry
                                                  ? {
                                                      disabled: params.disabled,
                                                      groupId: group.id,
                                                      onRetry: params.onTargetRetry,
                                                    }
                                                  : undefined,
                                              )
                                        }
                                        <div
                                          class="chat-model-picker-tags chat-controls__provider-model-list"
                                          data-chat-model-list="true"
                                          role="listbox"
                                          aria-label=${group.label}
                                        >
                                          ${repeat(
                                            group.options,
                                            (entry) => entry.value,
                                            (entry, targetIndex) =>
                                              renderChatModelPickerTargetOption({
                                                disabled: params.disabled,
                                                entry,
                                                groupId: group.id,
                                                groupLabel: group.label,
                                                index: orderedOptions.length + targetIndex,
                                                onHighlight: highlightOption,
                                                onSelect: selectTarget,
                                              }),
                                          )}
                                        </div>
                                      </section>
                                    `,
                                  )}
                                  ${
                                    params.accountSection?.render(
                                      orderedOptions.length + targetOptionCount,
                                    ) ?? nothing
                                  }
                                </div>
                                <div
                                  class="chat-controls__model-search-empty"
                                  data-chat-model-search-empty
                                  hidden
                                >
                                  ${t("chat.modelControls.noMatchingModels")}
                                </div>
                                ${
                                  params.contextWindow
                                    ? renderContextWindowControl(
                                        params.contextWindow,
                                        params.sessionKey,
                                      )
                                    : nothing
                                }
                              `
                            : nothing
                        }
                      </div>
                      <aside
                        class="chat-model-picker-modal__detail"
                        data-chat-model-detail
                        aria-live="polite"
                      >
                        ${renderModelPickerDetail({
                          option: previewOption,
                          modelLabel: previewOption
                            ? formatModelLabel(previewOption)
                            : params.triggerModelLabel,
                        })}
                      </aside>
                    </div>
                  `
            }
            ${
              params.modelSelectionLocked && params.accountSection
                ? html`<div class="chat-controls__model-options">
                    ${params.accountSection.render(0)}
                  </div>`
                : nothing
            }
          </div>
        </openclaw-modal-dialog>
      `
    : nothing;
  queueMicrotask(() => syncModelPickerPortal(modalTemplate));
  const detailsTemplate = html`
    <details
      class="chat-controls__inline-select chat-controls__model-picker"
      data-chat-autotype-shortcuts
      ?open=${params.open === true}
      ${ref((details) => syncChatModelSearch(details))}
      @keydown=${handleModelPickerKeydown}
      @toggle=${(event: Event) => {
        const details = event.currentTarget as HTMLDetailsElement;
        params.onOpenChange?.(details.open);
        handleChatComposerDetailsToggle(event);
        syncChatPickerOverlay(details);
        if (!details.open) {
          params.accountSection?.onClose();
          resetModelSearch(details);
          modelPickerPreviewKeys.delete(params.sessionKey);
          return;
        }
        void params.onOpen?.();
        if (selectedKey) {
          modelPickerPreviewKeys.set(params.sessionKey, selectedKey);
        }
        syncChatModelSearch(details);
      }}
    >
      <summary
        class="chat-controls__inline-select-trigger chat-controls__model-trigger ${
          params.triggerLoading ? "chat-controls__model-trigger--loading" : ""
        } ${params.disabled ? "chat-controls__inline-select-trigger--disabled" : ""}"
        data-chat-model-select="true"
        data-chat-model-locked=${params.modelSelectionLocked ? "true" : "false"}
        data-chat-select-value=${params.selectedModelValue}
        data-chat-model-tools=${modelToolsUnavailable ? "unavailable" : "available"}
        aria-label=${`${t("chat.selectors.model")}: ${triggerTitle}${
          params.selectionScopeDescription ? `. ${params.selectionScopeDescription}` : ""
        }`}
        aria-busy=${params.triggerLoading ? "true" : "false"}
        aria-disabled=${params.disabled ? "true" : "false"}
        title=${params.disabledReason?.trim() || params.selectionScopeDescription || triggerTitle}
        @click=${(event: MouseEvent) => {
          if (params.disabled) {
            event.preventDefault();
            return;
          }
          (event.currentTarget as HTMLElement).focus({ preventScroll: true });
        }}
      >
        ${
          modelToolsUnavailable
            ? html`
                <openclaw-tooltip .content=${t("chat.modelControls.chatOnlyHelp")}>
                  <span class="chat-controls__model-capability-badge" aria-hidden="true">
                    ${icons.alertTriangle}
                    <span>${t("chat.modelControls.chatOnly")}</span>
                  </span>
                </openclaw-tooltip>
              `
            : nothing
        }
        ${triggerProviderIcon}
        <span class="chat-controls__inline-select-label">
          ${
            params.triggerLoading
              ? html`<span
                  class="skeleton chat-controls__model-trigger-skeleton"
                  aria-hidden="true"
                ></span>`
              : (params.triggerStatusLabel ?? params.triggerModelLabel)
          }
        </span>
        ${
          showContextWindowBadge
            ? html`
                <span
                  class="chat-controls__locked-model-badge chat-controls__model-context-badge"
                  data-chat-model-context-badge
                >
                  ${selectedContextWindowOption.label}
                </span>
              `
            : nothing
        }
        <span class="chat-controls__inline-select-chevron" aria-hidden="true"
          >${icons.chevronUp}</span
        >
      </summary>
    </details>
  `;
  return detailsTemplate;
}
