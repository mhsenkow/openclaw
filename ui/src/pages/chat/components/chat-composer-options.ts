import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../../../components/icons.ts";
import { t } from "../../../i18n/index.ts";
import {
  renderChatPermissionPicker,
  type ChatPermissionPickerProps,
} from "./chat-permission-picker.ts";
import { handleChatComposerDetailsToggle } from "./chat-picker-overlay.ts";

export type ChatComposerOptionsProps = {
  permission?: ChatPermissionPickerProps;
  modelControls: TemplateResult | typeof nothing;
  /** Compact chip labels when a control differs from its agent default. */
  overrideLabels?: readonly string[];
};

/**
 * One quiet footer affordance that hosts permission, model, and effort pickers.
 * The trigger stays icon-only while every control is at its default.
 */
export function renderChatComposerOptions(props: ChatComposerOptionsProps) {
  const overrides = props.overrideLabels?.filter(Boolean) ?? [];
  const hasOverrides = overrides.length > 0;
  const summary = hasOverrides ? overrides.join(" · ") : t("chat.composer.options.default");
  return html`
    <details class="chat-composer-options" @toggle=${handleChatComposerDetailsToggle}>
      <summary
        class="chat-composer-options__trigger chat-controls__inline-select-trigger ${
          hasOverrides ? "chat-composer-options__trigger--active" : ""
        }"
        aria-label=${t("chat.composer.options.label")}
        title=${summary}
      >
        <span class="chat-composer-options__icon" aria-hidden="true">${icons.settings}</span>
        ${
          hasOverrides
            ? html`<span class="chat-composer-options__summary chat-controls__inline-select-label"
                >${summary}</span
              >`
            : nothing
        }
      </summary>
      <div
        class="chat-composer-options__menu"
        role="group"
        aria-label=${t("chat.composer.options.label")}
      >
        ${
          props.permission
            ? html`<div class="chat-composer-options__section">
                <div class="chat-composer-options__section-label">
                  ${t("chat.permissionControls.label")}
                </div>
                ${renderChatPermissionPicker(props.permission)}
              </div>`
            : nothing
        }
        <div class="chat-composer-options__section chat-composer-options__section--models">
          <div class="chat-composer-options__section-label">
            ${t("chat.composer.options.model")}
          </div>
          ${props.modelControls}
        </div>
      </div>
    </details>
  `;
}
