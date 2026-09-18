import { describe, expect, it } from "vitest";
import type { ModelChoice } from "../../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { buildModelsLocalResult } from "./local.js";

const localWarm: ModelChoice = {
  id: "llama3",
  name: "Llama 3",
  provider: "ollama",
  local: true,
  localModel: { resident: true, parameterSize: "8B", quantization: "Q4_K_M" },
};

const localCold: ModelChoice = {
  id: "mistral",
  name: "Mistral",
  provider: "ollama",
  local: true,
  localModel: { resident: false, parameterSize: "7B" },
};

const remote: ModelChoice = {
  id: "gpt-5",
  name: "GPT-5",
  provider: "openai",
  local: false,
};

describe("buildModelsLocalResult", () => {
  it("keeps only local catalog models and orders warm rows first", () => {
    const result = buildModelsLocalResult({
      models: [remote, localCold, localWarm],
      providerOutcomes: [{ provider: "ollama", status: "ready" }],
    });
    expect(result.runtimes).toHaveLength(1);
    expect(result.runtimes[0]).toMatchObject({
      provider: "ollama",
      reachable: true,
      modelCount: 2,
      residentCount: 1,
      startHint: "ollama serve",
    });
    expect(result.models.map((model) => model.key)).toEqual(["ollama/llama3", "ollama/mistral"]);
    expect(result.models[0]?.resident).toBe(true);
  });

  it("includes configured unreachable providers with an actionable start hint", () => {
    const result = buildModelsLocalResult({
      models: [],
      configured: [
        {
          provider: "lmstudio",
          baseUrl: "http://127.0.0.1:1234/v1",
          startHint: "lms server start",
        },
      ],
      probes: [
        {
          provider: "lmstudio",
          baseUrl: "http://127.0.0.1:1234/v1",
          status: "unreachable",
          startHint: "lms server start",
          error: "connect ECONNREFUSED",
        },
      ],
    });
    expect(result.runtimes).toEqual([
      {
        provider: "lmstudio",
        baseUrl: "http://127.0.0.1:1234/v1",
        reachable: false,
        startHint: "lms server start",
        modelCount: 0,
        residentCount: 0,
        models: [],
      },
    ]);
  });
});
