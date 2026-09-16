import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveModelPolicyDiscoveryScope } from "./model-policy-discovery-scope.js";

function config(cfg: Partial<OpenClawConfig>): OpenClawConfig {
  return cfg as OpenClawConfig;
}

describe("resolveModelPolicyDiscoveryScope", () => {
  it("reports a configured provider the allowlist never names", () => {
    const scope = resolveModelPolicyDiscoveryScope({
      cfg: config({
        agents: { defaults: { modelPolicy: { allow: ["openai/gpt-5.5"] } } },
      }),
      configuredProviders: ["ollama", "openai"],
    });

    expect(scope).toEqual({
      configPath: "agents.defaults.modelPolicy.allow",
      repairConfigPath: "agents.defaults.modelPolicy.allow",
      skippedProviders: ["ollama"],
    });
  });

  it("treats a provider wildcard as covering that provider", () => {
    expect(
      resolveModelPolicyDiscoveryScope({
        cfg: config({
          agents: { defaults: { modelPolicy: { allow: ["ollama/*", "openai/gpt-5.5"] } } },
        }),
        configuredProviders: ["ollama", "openai"],
      }),
    ).toBeUndefined();
  });

  it("imposes no scope when no allowlist is configured", () => {
    expect(
      resolveModelPolicyDiscoveryScope({
        cfg: config({ agents: { defaults: {} } }),
        configuredProviders: ["ollama"],
      }),
    ).toBeUndefined();
  });

  it("points a repair at the agent-scoped allowlist that governs the request", () => {
    const scope = resolveModelPolicyDiscoveryScope({
      cfg: config({
        agents: {
          defaults: { modelPolicy: { allow: ["ollama/*"] } },
          list: [{ id: "scoped", modelPolicy: { allow: ["openai/gpt-5.5"] } }],
        },
      }),
      agentId: "scoped",
      configuredProviders: ["ollama"],
    });

    expect(scope).toMatchObject({
      repairConfigPath: "agents.entries.*.modelPolicy.allow",
      skippedProviders: ["ollama"],
    });
  });
});
