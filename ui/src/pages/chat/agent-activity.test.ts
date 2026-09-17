import { describe, expect, it } from "vitest";
import type { ActivityEntry } from "../activity/tool-activity.ts";
import { projectAgentActivity } from "./agent-activity.ts";

function localDay(year: number, monthIndex: number, day: number, hour = 12): number {
  return new Date(year, monthIndex, day, hour).getTime();
}

function entry(
  overrides: Partial<ActivityEntry> & Pick<ActivityEntry, "id" | "sessionKey">,
): ActivityEntry {
  const startedAt = overrides.startedAt ?? localDay(2026, 8, 16);
  return {
    toolCallId: overrides.id,
    runId: "run",
    toolName: "bash",
    entryKind: "tool",
    status: "done",
    startedAt,
    updatedAt: overrides.updatedAt ?? startedAt,
    durationMs: 10,
    outputTruncated: false,
    summary: "bash completed",
    hiddenArgumentCount: 0,
    ...overrides,
  };
}

describe("projectAgentActivity", () => {
  it("groups matching session and agent-prefixed entries by day", () => {
    const days = projectAgentActivity(
      [
        entry({
          id: "a",
          sessionKey: "agent:main:main",
          toolName: "Connect Gmail",
          updatedAt: localDay(2026, 8, 16, 17),
        }),
        entry({
          id: "b",
          sessionKey: "agent:main:side",
          toolName: "Search memory",
          updatedAt: localDay(2026, 8, 15, 19),
        }),
        entry({
          id: "c",
          sessionKey: "agent:other:main",
          toolName: "Ignored",
          updatedAt: localDay(2026, 8, 16, 10),
        }),
      ],
      { agentId: "main", sessionKey: "agent:main:main" },
    );
    expect(days.map((day) => day.key)).toEqual(["2026-09-16", "2026-09-15"]);
    expect(days[0]!.rows.map((row) => row.title)).toEqual(["Connect Gmail"]);
    expect(days[1]!.rows.map((row) => row.title)).toEqual(["Search memory"]);
  });
});
