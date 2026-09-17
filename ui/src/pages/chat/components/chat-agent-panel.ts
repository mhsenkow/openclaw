import "../../../styles/chat/agent-panel.css";
import { consume } from "@lit/context";
import { html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { applicationContext, type ApplicationContext } from "../../../app/context.ts";
import type { ExecApprovalDecision } from "../../../app/exec-approval.ts";
import { renderSidebarApprovalRow } from "../../../components/exec-approval-card.ts";
import { icons } from "../../../components/icons.ts";
import { renderAgentIdentityAvatar } from "../../../components/identity-avatar-view.ts";
import { renderPanelEmptyState } from "../../../components/panel-empty-state.ts";
import { t } from "../../../i18n/index.ts";
import { formatTimeMs } from "../../../lib/format.ts";
import { areUiSessionKeysEquivalent } from "../../../lib/sessions/session-key.ts";
import { OpenClawLightDomElement } from "../../../lit/openclaw-element.ts";
import { projectAgentActivity, type AgentActivityDay } from "../agent-activity.ts";

type AgentPanelTab = "activity" | "approvals";

function dayLabel(timestamp: number | null): string {
  if (timestamp === null) {
    return t("activityFeed.unknownDate");
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  if (timestamp === today) {
    return t("activityFeed.today");
  }
  if (timestamp === yesterday) {
    return t("activityFeed.yesterday");
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export class ChatAgentPanelElement extends OpenClawLightDomElement {
  @consume({ context: applicationContext, subscribe: true })
  private context!: ApplicationContext;

  @property() agentId: string | null = null;
  @property() sessionKey = "";
  @property() assistantName = "";
  @property() assistantAvatar: string | null = null;
  @property() assistantAvatarText: string | null = null;
  @property({ type: Boolean }) presented = false;

  @state() private tab: AgentPanelTab = "activity";
  @state() private activityDays: AgentActivityDay[] = [];
  private stopLiveActivity: (() => void) | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.bindLiveActivity();
  }

  override disconnectedCallback() {
    this.stopLiveActivity?.();
    this.stopLiveActivity = null;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>) {
    if (
      changed.has("agentId") ||
      changed.has("sessionKey") ||
      changed.has("presented") ||
      changed.has("context")
    ) {
      this.bindLiveActivity();
      this.refreshActivity();
    }
  }

  private bindLiveActivity() {
    this.stopLiveActivity?.();
    this.stopLiveActivity = null;
    const liveActivity = this.context?.liveActivity;
    if (!liveActivity || !this.presented) {
      return;
    }
    this.stopLiveActivity = liveActivity.subscribe(() => this.refreshActivity());
  }

  private refreshActivity() {
    const liveActivity = this.context?.liveActivity;
    if (!liveActivity) {
      this.activityDays = [];
      return;
    }
    this.activityDays = projectAgentActivity(liveActivity.snapshot.entries, {
      agentId: this.agentId,
      sessionKey: this.sessionKey,
    });
  }

  private get connectedPhase(): boolean {
    return this.context?.gateway.snapshot.phase === "connected";
  }

  private get approvalQueue() {
    const queue = this.context?.overlays.snapshot.approvalQueue ?? [];
    const agentId = this.agentId?.trim();
    const sessionKey = this.sessionKey.trim();
    return queue.filter((approval) => {
      const key = approval.request.sessionKey?.trim();
      if (!key) {
        return false;
      }
      if (sessionKey && areUiSessionKeysEquivalent(key, sessionKey)) {
        return true;
      }
      return Boolean(agentId) && key.startsWith(`agent:${agentId}:`);
    });
  }

  private async decideApproval(event: Event, approvalId: string, decision: ExecApprovalDecision) {
    event.preventDefault();
    event.stopPropagation();
    await this.context?.overlays.decideApproval(decision, approvalId);
  }

  private renderHeader(): TemplateResult {
    const name = this.assistantName.trim() || t("chat.sidePanel.agent");
    const connected = this.connectedPhase;
    return html`
      <header class="chat-agent-panel__header">
        <span class="chat-agent-panel__avatar" aria-hidden="true">
          ${renderAgentIdentityAvatar({
            id: this.agentId ?? "agent",
            avatar: this.assistantAvatar,
            textAvatar: this.assistantAvatarText,
          })}
        </span>
        <div class="chat-agent-panel__identity">
          <strong class="chat-agent-panel__name">${name}</strong>
          <span
            class="chat-agent-panel__status ${
              connected ? "chat-agent-panel__status--connected" : ""
            }"
          >
            <span class="chat-agent-panel__status-dot" aria-hidden="true"></span>
            ${t(connected ? "chat.sidePanel.agentConnected" : "chat.sidePanel.agentOffline")}
          </span>
        </div>
      </header>
    `;
  }

  private renderTabs(): TemplateResult {
    const approvalsCount = this.approvalQueue.length;
    return html`
      <div class="chat-agent-panel__tabs" role="tablist" aria-label=${t("chat.sidePanel.agent")}>
        <button
          type="button"
          role="tab"
          class="chat-agent-panel__tab ${this.tab === "activity" ? "is-active" : ""}"
          aria-selected=${String(this.tab === "activity")}
          @click=${() => {
            this.tab = "activity";
          }}
        >
          ${t("chat.sidePanel.agentActivity")}
        </button>
        <button
          type="button"
          role="tab"
          class="chat-agent-panel__tab ${this.tab === "approvals" ? "is-active" : ""}"
          aria-selected=${String(this.tab === "approvals")}
          @click=${() => {
            this.tab = "approvals";
          }}
        >
          ${t("chat.sidePanel.agentApprovals")}
          ${
            approvalsCount > 0
              ? html`<span class="chat-agent-panel__tab-badge" aria-hidden="true"
                  >${approvalsCount}</span
                >`
              : nothing
          }
        </button>
      </div>
    `;
  }

  private renderActivity(): TemplateResult {
    if (this.activityDays.length === 0) {
      return renderPanelEmptyState({
        icon: icons.activity,
        heading: t("chat.sidePanel.agentActivity"),
        description: t("chat.sidePanel.agentActivityEmpty"),
      });
    }
    return html`
      <div class="chat-agent-panel__feed" role="list">
        ${this.activityDays.map(
          (day) => html`
            <section class="chat-agent-panel__day">
              <h3 class="chat-agent-panel__day-label">${dayLabel(day.timestamp)}</h3>
              ${day.rows.map(
                (row) => html`
                  <article
                    class="chat-agent-panel__row chat-agent-panel__row--${row.status}"
                    role="listitem"
                  >
                    <span class="chat-agent-panel__row-icon" aria-hidden="true"
                      >${icons.activity}</span
                    >
                    <div class="chat-agent-panel__row-body">
                      <div class="chat-agent-panel__row-title">${row.title}</div>
                      <div class="chat-agent-panel__row-detail">${row.detail}</div>
                    </div>
                    <time
                      class="chat-agent-panel__row-time"
                      datetime=${new Date(row.timestamp).toISOString()}
                      >${formatTimeMs(row.timestamp)}</time
                    >
                  </article>
                `,
              )}
            </section>
          `,
        )}
      </div>
    `;
  }

  private renderApprovals(): TemplateResult {
    const queue = this.approvalQueue;
    if (queue.length === 0) {
      return renderPanelEmptyState({
        icon: icons.shieldQuestion,
        heading: t("chat.sidePanel.agentApprovals"),
        description: t("chat.sidePanel.agentApprovalsEmpty"),
      });
    }
    const snapshot = this.context.overlays.snapshot;
    return html`
      <div class="chat-agent-panel__approvals" role="list">
        ${queue.map((approval) => {
          const sessionKey = approval.request.sessionKey?.trim();
          const session = sessionKey
            ? this.context.sessions.state.result?.sessions.find((candidate) =>
                areUiSessionKeysEquivalent(candidate.key, sessionKey),
              )
            : undefined;
          return renderSidebarApprovalRow({
            approval,
            busy: snapshot.approvalBusy,
            canGrant: snapshot.approvalCanGrant,
            error: snapshot.approvalErrors.get(approval.id) ?? null,
            sessionTitle: session?.displayName?.trim() || session?.label?.trim(),
            onDecision: (event, approvalId, decision) =>
              void this.decideApproval(event, approvalId, decision),
          });
        })}
      </div>
    `;
  }

  override render() {
    if (!this.context) {
      return nothing;
    }
    return html`
      <div class="chat-agent-panel">
        ${this.renderHeader()} ${this.renderTabs()}
        <div class="chat-agent-panel__body" role="tabpanel">
          ${this.tab === "activity" ? this.renderActivity() : this.renderApprovals()}
        </div>
      </div>
    `;
  }
}

if (!customElements.get("openclaw-chat-agent-panel")) {
  customElements.define("openclaw-chat-agent-panel", ChatAgentPanelElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "openclaw-chat-agent-panel": ChatAgentPanelElement;
  }
}
