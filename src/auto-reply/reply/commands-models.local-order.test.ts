import { describe, expect, it } from "vitest";
import { orderModelsIdsLocalFirst, orderModelsProvidersLocalFirst } from "./commands-models.js";

describe("local-first /models ordering", () => {
  it("orders local providers ahead of remote providers", () => {
    expect(
      orderModelsProvidersLocalFirst({
        providers: ["openai", "ollama", "anthropic"],
        catalog: [
          { provider: "openai", baseUrl: "https://api.openai.com/v1" },
          { provider: "ollama", baseUrl: "http://127.0.0.1:11434", localModel: { resident: true } },
          { provider: "anthropic", baseUrl: "https://api.anthropic.com" },
        ],
      }),
    ).toEqual(["ollama", "anthropic", "openai"]);
  });

  it("orders warm local models ahead of cold ones within a provider", () => {
    expect(
      orderModelsIdsLocalFirst({
        provider: "ollama",
        modelIds: ["mistral", "llama3", "phi"],
        catalog: [
          { provider: "ollama", id: "mistral", localModel: { resident: false } },
          { provider: "ollama", id: "llama3", localModel: { resident: true } },
          { provider: "ollama", id: "phi" },
        ],
      }),
    ).toEqual(["llama3", "mistral", "phi"]);
  });
});
