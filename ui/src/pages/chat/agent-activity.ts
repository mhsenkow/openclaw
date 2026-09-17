import type { ActivityEntry } from "../activity/tool-activity.ts";

export type AgentActivityRow = {
  id: string;
  title: string;
  detail: string;
  timestamp: number;
  status: ActivityEntry["status"];
};

export type AgentActivityDay = {
  key: string;
  timestamp: number | null;
  rows: AgentActivityRow[];
};

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function belongsToAgent(
  entry: ActivityEntry,
  params: { agentId: string | null; sessionKey: string },
): boolean {
  const sessionKey = entry.sessionKey?.trim();
  if (!sessionKey) {
    return false;
  }
  if (sessionKey === params.sessionKey) {
    return true;
  }
  const agentId = params.agentId?.trim();
  return Boolean(agentId) && sessionKey.startsWith(`agent:${agentId}:`);
}

function rowFromEntry(entry: ActivityEntry): AgentActivityRow {
  const detail =
    entry.outputPreview?.trim() ||
    (entry.status === "running" ? "In progress" : entry.status === "error" ? "Failed" : "Done");
  return {
    id: entry.id,
    title: entry.toolName || entry.summary,
    detail: detail.length > 120 ? `${detail.slice(0, 117)}…` : detail,
    timestamp: entry.updatedAt || entry.startedAt,
    status: entry.status,
  };
}

/** Day-grouped live tool activity for the selected agent/session. */
export function projectAgentActivity(
  entries: readonly ActivityEntry[],
  params: { agentId: string | null; sessionKey: string },
): AgentActivityDay[] {
  const matching = entries
    .filter((entry) => belongsToAgent(entry, params))
    .map(rowFromEntry)
    .toSorted((left, right) => right.timestamp - left.timestamp);
  const grouped = new Map<string, AgentActivityRow[]>();
  for (const row of matching) {
    const key = row.timestamp > 0 ? dayKey(row.timestamp) : "unknown";
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }
  return [...grouped.entries()].map(([key, rows]) => ({
    key,
    timestamp: key === "unknown" ? null : dayStart(rows[0]!.timestamp),
    rows,
  }));
}
