import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  listConfiguredLocalProviders,
  resolveLocalProviderStartHint,
} from "./local-provider-reachability.js";

describe("local provider reachability helpers", () => {
  it("prefers localService.command for the start hint", () => {
    expect(
      resolveLocalProviderStartHint({
        provider: "custom-local",
        providerConfig: {
          baseUrl: "http://127.0.0.1:9000/v1",
          api: "openai-completions",
          localService: { command: "/opt/serve", args: ["--port", "9000"] },
          models: [],
        },
      }),
    ).toBe("/opt/serve --port 9000");
  });

  it("uses known runtime start commands when localService is absent", () => {
    expect(resolveLocalProviderStartHint({ provider: "ollama" })).toBe("ollama serve");
    expect(resolveLocalProviderStartHint({ provider: "lmstudio" })).toBe("lms server start");
    expect(resolveLocalProviderStartHint({ provider: "vllm" })).toBe("vllm serve <model-id>");
  });

  it("lists configured providers with local base URLs", () => {
    const cfg = {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://127.0.0.1:11434",
            api: "ollama",
            models: [{ id: "llama3", name: "Llama 3" }],
          },
          openai: {
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            models: [{ id: "gpt-5", name: "GPT-5" }],
          },
        },
      },
    } as OpenClawConfig;
    const rows = listConfiguredLocalProviders(cfg);
    expect(rows.map((row) => row.provider)).toEqual(["ollama"]);
    expect(rows[0]?.baseUrl).toBe("http://127.0.0.1:11434");
  });
});
