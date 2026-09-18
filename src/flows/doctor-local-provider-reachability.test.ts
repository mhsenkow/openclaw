import { describe, expect, it, vi } from "vitest";
import { createCoreHealthChecks } from "./doctor-core-checks.js";
import type { HealthFinding } from "./health-checks.js";

describe("local provider reachability doctor check", () => {
  it("surfaces unreachable configured local providers with a start hint", async () => {
    const finding: HealthFinding = {
      checkId: "core/doctor/local-provider-reachability",
      severity: "warning",
      source: "doctor",
      target: "ollama",
      path: "models.providers.ollama",
      message: 'Configured local provider "ollama" at http://127.0.0.1:11434 is unreachable.',
      requirement: "a reachable local model server",
      fixHint: "Start it with: ollama serve. Doctor does not auto-start local model servers.",
    };
    const checks = createCoreHealthChecks({
      async detectUnavailableSkills() {
        return [];
      },
      async collectSecurityWarnings() {
        return [];
      },
      async collectWorkspaceSuggestionNotes() {
        return [];
      },
      async collectRuntimeToolSchemaFindings() {
        return [];
      },
      async collectProviderCatalogProjectionFindings() {
        return [];
      },
      async collectLocalAudioAccelerationFindings() {
        return [];
      },
      async collectLocalProviderReachabilityFindings() {
        return [finding];
      },
      async collectGatewayHealthFindings() {
        return [];
      },
      async collectGatewayDaemonFindings() {
        return [];
      },
      async listGatewayCronJobs() {
        return [];
      },
    });
    const check = checks.find((entry) => entry.id === "core/doctor/local-provider-reachability");
    expect(check).toBeDefined();
    await expect(
      check!.detect({
        mode: "lint",
        runtime: { log: vi.fn(), error: vi.fn(), exit: vi.fn() } as never,
        cfg: {},
      }),
    ).resolves.toEqual([finding]);
  });
});
