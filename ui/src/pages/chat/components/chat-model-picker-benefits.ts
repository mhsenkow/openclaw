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

/** Factual strengths from catalog fields — no invented marketing claims. */
export function modelPickerBenefits(option: ChatModelPickerOption): ModelPickerBenefit[] {
  const benefits: ModelPickerBenefit[] = [];
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
  if (option.local) {
    benefits.push({
      title: t("chat.modelControls.benefitLocalTitle"),
      detail: t("chat.modelControls.benefitLocalDetail"),
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
  return html`
    <div class="chat-model-picker-detail__header">
      <p class="chat-model-picker-detail__provider">${providerDisplayLabel(option.provider)}</p>
      <h3 class="chat-model-picker-detail__name">${params.modelLabel}</h3>
      ${
        option.disabled && option.unavailableReason
          ? html`<p class="chat-model-picker-detail__warning" role="status">
              ${
                option.unavailableReason === "missing-auth" ||
                option.unavailableReason === "auth-failed"
                  ? t("modelSetup.candidates.signInNeeded")
                  : t("chat.modelControls.runtimeUnavailable")
              }
            </p>`
          : nothing
      }
    </div>
    ${
      tags.length > 0
        ? html`<ul
            class="chat-model-picker-detail__tags"
            aria-label=${t("chat.modelControls.detailTags")}
          >
            ${tags.map((tag) => html`<li>${tag}</li>`)}
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
