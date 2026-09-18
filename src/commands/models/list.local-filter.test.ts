import { describe, expect, it } from "vitest";
import type { ModelChoice } from "../../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { toCliModelRow } from "./list.list-command.js";

describe("models list local/resident projection", () => {
  it("projects localModel facts and a warm tag for resident models", () => {
    const model: ModelChoice = {
      id: "llama3",
      name: "Llama 3",
      provider: "ollama",
      local: true,
      available: true,
      localModel: { resident: true, parameterSize: "8B" },
      tags: ["default"],
    };
    expect(toCliModelRow(model)).toEqual({
      key: "ollama/llama3",
      name: "Llama 3",
      input: "-",
      contextWindow: null,
      local: true,
      available: true,
      localModel: { resident: true, parameterSize: "8B" },
      tags: ["default", "warm"],
    });
  });
});
