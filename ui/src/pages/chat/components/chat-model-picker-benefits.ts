import { html, nothing, type TemplateResult } from "lit";
import { providerDisplayLabel } from "../../../components/provider-icon.ts";
import { t } from "../../../i18n/index.ts";
import { registerModelControlsEnglish } from "../../../i18n/locales/en-model-controls.ts";
import { formatContextTokenCapacity } from "../../../lib/format.ts";
import type { ChatModelPickerOption } from "./chat-model-picker-options.ts";

registerModelControlsEnglish();

export type ModelPickerBenefit = {
  title: string;
  detail: string;
};

const TAG_LABELS: Readonly<Record<string, string>> = {
  configured: "Configured",
  fallback: "Fallback",
  fallback1: "Fallback 1",
  fallback2: "Fallback 2",
  fallback3: "Fallback 3",
  default: "Default",
  local: "Local",
};

/** Turn opaque gateway tags into readable labels; unknown tags stay as-is for search. */
export function formatModelPickerTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    return tag;
  }
  const mapped = TAG_LABELS[normalized];
  if (mapped) {
    return mapped;
  }
  const fallbackMatch = /^fallback(\d+)$/i.exec(normalized);
  if (fallbackMatch) {
    return `Fallback ${fallbackMatch[1]}`;
  }
  return tag;
}

export type ModelUnavailableAction = "connect-provider" | null;

/** Map catalog unavailableReason to the picker's next-step action. */
export function modelUnavailableAction(
  option: Pick<ChatModelPickerOption, "disabled" | "unavailableReason">,
): ModelUnavailableAction {
  if (!option.disabled) {
    return null;
  }
  if (option.unavailableReason === "missing-auth" || option.unavailableReason === "auth-failed") {
    return "connect-provider";
  }
  return null;
}

/** Factual strengths from catalog fields — no invented marketing claims. */
export function modelPickerBenefits(option: ChatModelPickerOption): ModelPickerBenefit[] {
  const benefits: ModelPickerBenefit[] = [];
  if (option.local) {
    benefits.push({
      title: t("chat.modelControls.benefitLocalTitle"),
      detail: t("chat.modelControls.benefitLocalDetail"),
    });
    benefits.push({
      title: t("chat.modelControls.benefitNoKeyTitle"),
      detail: t("chat.modelControls.benefitNoKeyDetail"),
    });
  }
  if (option.localModel?.resident) {
    benefits.push({
      title: t("chat.modelControls.benefitWarmTitle"),
      detail: t("chat.modelControls.benefitWarmDetail"),
    });
  }
  const sizeChip = [option.localModel?.parameterSize, option.localModel?.quantization]
    .filter(Boolean)
    .join(" ");
  if (sizeChip) {
    benefits.push({
      title: t("chat.modelControls.benefitSizeTitle"),
      detail: t("chat.modelControls.benefitSizeDetail", { size: sizeChip }),
    });
  }
  const context = option.contextTokens ?? option.contextWindow;
  if (context) {
    benefits.push({
      title: t("chat.modelControls.benefitContextTitle"),
      detail: t("chat.modelControls.benefitContextDetail", {
        size: formatContextTokenCapacity(context),
      }),
    });
  }
  if (option.supportsTools === false) {
    benefits.push({
      title: t("chat.modelControls.chatOnly"),
      detail: t("chat.modelControls.chatOnlyHelp"),
    });
  } else if (option.supportsTools === true) {
    benefits.push({
      title: t("chat.modelControls.benefitToolsTitle"),
      detail: t("chat.modelControls.benefitToolsDetail"),
    });
  }
  if (option.reasoning) {
    benefits.push({
      title: t("chat.modelControls.benefitReasoningTitle"),
      detail: t("chat.modelControls.benefitReasoningDetail"),
    });
  }
  const inputs = option.input ?? [];
  if (inputs.includes("image") || inputs.includes("video")) {
    benefits.push({
      title: t("chat.modelControls.benefitVisionTitle"),
      detail: t("chat.modelControls.benefitVisionDetail"),
    });
  }
  if (inputs.includes("audio")) {
    benefits.push({
      title: t("chat.modelControls.benefitAudioTitle"),
      detail: t("chat.modelControls.benefitAudioDetail"),
    });
  }
  if (option.isDefault) {
    benefits.push({
      title: t("chat.modelControls.default"),
      detail: t("chat.modelControls.benefitDefaultDetail"),
    });
  }
  return benefits;
}

export function renderModelPickerDetail(params: {
  option: ChatModelPickerOption | undefined;
  modelLabel: string;
  onModelSetup?: () => void;
}): TemplateResult {
  const option = params.option;
  if (!option) {
    return html`
      <div class="chat-model-picker-detail__empty" role="status">
        <strong>${t("chat.modelControls.detailEmptyTitle")}</strong>
        <p>${t("chat.modelControls.detailEmptyBody")}</p>
      </div>
    `;
  }
  const benefits = modelPickerBenefits(option);
  const tags = option.tags?.filter(Boolean) ?? [];
  const unavailableAction = modelUnavailableAction(option);
  const needsAuth = unavailableAction === "connect-provider";
  return html`
    <div class="chat-model-picker-detail__header">
      <p class="chat-model-picker-detail__provider">${providerDisplayLabel(option.provider)}</p>
      <h3 class="chat-model-picker-detail__name">${params.modelLabel}</h3>
      ${
        option.disabled && option.unavailableReason
          ? html`<p class="chat-model-picker-detail__warning" role="status">
              ${
                needsAuth
                  ? t("modelSetup.candidates.signInNeeded")
                  : t("chat.modelControls.runtimeUnavailable")
              }
            </p>`
          : nothing
      }
      ${
        needsAuth && params.onModelSetup
          ? html`<button
              class="btn btn--sm"
              type="button"
              @click=${(event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                params.onModelSetup?.();
              }}
            >
              ${t("chat.modelControls.connectProvider")}
            </button>`
          : nothing
      }
    </div>
    ${
      tags.length > 0
        ? html`<ul
            class="chat-model-picker-detail__tags"
            aria-label=${t("chat.modelControls.detailTags")}
          >
            ${tags.map((tag) => html`<li title=${tag}>${formatModelPickerTag(tag)}</li>`)}
          </ul>`
        : nothing
    }
    ${
      benefits.length > 0
        ? html`<ul class="chat-model-picker-detail__benefits">
            ${benefits.map(
              (benefit) => html`
                <li>
                  <strong>${benefit.title}</strong>
                  <p>${benefit.detail}</p>
                </li>
              `,
            )}
          </ul>`
        : html`<p class="chat-model-picker-detail__fallback">
            ${t("chat.modelControls.detailFallback")}
          </p>`
    }
  `;
}
