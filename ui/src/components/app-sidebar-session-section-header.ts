import { html, nothing, type TemplateResult } from "lit";
import { startHoverMarqueeFromEvent, stopHoverMarqueeFromEvent } from "../lib/hover-marquee.ts";
import { writeSidebarSectionDragData } from "../lib/sessions/drag.ts";

/**
 * Which axis a section groups by. Three unrelated taxonomies share this header,
 * so the kind is what lets the stylesheet keep them in separate visual
 * registers instead of rendering people, topics, and harnesses identically.
 */
export type SidebarSectionKind = "people" | "taxonomy" | "catalog";

export function renderSidebarSessionSectionHeader(params: {
  sectionId: string;
  content: TemplateResult;
  kind?: SidebarSectionKind;
  draggable?: boolean;
  disabledReason?: string;
  onStartDrag: (sectionId: string) => void;
  onFinishDrag: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}) {
  const draggable = params.draggable !== false && !params.disabledReason;
  return html`
    <div
      class="sidebar-recent-sessions__head ${
        draggable ? "sidebar-recent-sessions__head--draggable" : ""
      }"
      data-section-kind=${params.kind ?? "taxonomy"}
      draggable=${draggable ? "true" : "false"}
      title=${params.disabledReason ?? nothing}
      @mousedown=${(event: MouseEvent) => {
        const header = event.currentTarget as HTMLElement;
        header.toggleAttribute(
          "data-section-drag-blocked",
          Boolean((event.target as HTMLElement).closest("button, a")),
        );
      }}
      @mouseup=${(event: MouseEvent) => {
        (event.currentTarget as HTMLElement).removeAttribute("data-section-drag-blocked");
      }}
      @dragstart=${(event: DragEvent) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        const header = event.currentTarget as HTMLElement;
        const startedFromControl =
          Boolean((event.target as HTMLElement).closest("button, a")) ||
          header.hasAttribute("data-section-drag-blocked");
        header.removeAttribute("data-section-drag-blocked");
        if (startedFromControl) {
          event.preventDefault();
          return;
        }
        if (event.dataTransfer) {
          writeSidebarSectionDragData(event.dataTransfer, params.sectionId);
          params.onStartDrag(params.sectionId);
        }
      }}
      @dragend=${(event: DragEvent) => {
        (event.currentTarget as HTMLElement).removeAttribute("data-section-drag-blocked");
        params.onFinishDrag();
      }}
      @mouseenter=${startHoverMarqueeFromEvent}
      @mouseleave=${stopHoverMarqueeFromEvent}
      @contextmenu=${params.onContextMenu ?? nothing}
    >
      <span class="sidebar-session-group-drag-handle" aria-hidden="true"></span>
      ${params.content}
    </div>
  `;
}
