import { describe, expect, it } from "vitest";
import { buildPublicModelProjection } from "../../../../../src/gateway/server-methods/models-list-public-projection.js";
import {
  formatModelPickerTag,
  modelPickerBenefits,
  modelUnavailableAction,
} from "./chat-model-picker-benefits.ts";
import type { ChatModelPickerOption } from "./chat-model-picker-options.ts";

function optionFromProjection(
  projected: ReturnType<typeof buildPublicModelProjection>,
): ChatModelPickerOption {
  return {
    commitValue: `${projected.provider}/${projected.id}`,
    contextTokens: projected.contextTokens,
    contextWindow: projected.contextWindow,
    input: projected.input,
    isDefault: false,
    label: projected.name,
    local: projected.local,
    provider: projected.provider,
    reasoning: projected.reasoning,
    supportsTools: projected.supportsTools,
    value: `${projected.provider}/${projected.id}`,
  };
}

describe("modelPickerBenefits", () => {
  it("includes Runs locally when the option is marked local", () => {
    const benefits = modelPickerBenefits({
      commitValue: "ollama/qwen2.5:7b",
      isDefault: false,
      label: "qwen2.5:7b",
      local: true,
      provider: "ollama",
      value: "ollama/qwen2.5:7b",
    });
    expect(benefits.map((benefit) => benefit.title)).toEqual(
      expect.arrayContaining(["Runs locally", "No API key needed"]),
    );
  });

  it("surfaces warm and size benefits from localModel facts", () => {
    const benefits = modelPickerBenefits({
      commitValue: "ollama/qwen2.5:7b",
      isDefault: false,
      label: "qwen2.5:7b",
      local: true,
      localModel: { resident: true, parameterSize: "7B", quantization: "Q4_K_M" },
      provider: "ollama",
      value: "ollama/qwen2.5:7b",
    });
    expect(benefits.map((benefit) => benefit.title)).toEqual(
      expect.arrayContaining(["Already loaded", "Size"]),
    );
  });

  // End-to-end: a loopback catalog row must produce the local benefit through
  // the same projection the Control UI receives. Today the public projection
  // drops `local` unless includeDetails is set, so this fails on the pre-fix path.
  it("produces Runs locally for a loopback catalog row the Control UI loads", () => {
    const projected = buildPublicModelProjection({
      id: "qwen2.5:7b",
      name: "qwen2.5:7b",
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      input: ["text", "image"],
      contextWindow: 32_768,
      contextTokens: 16_384,
    });
    const benefits = modelPickerBenefits(optionFromProjection(projected));
    expect(benefits.map((benefit) => benefit.title)).toContain("Runs locally");
  });

  it("surfaces Vision when includeDetails carries input modalities", () => {
    const projected = buildPublicModelProjection(
      {
        id: "qwen2.5:7b",
        name: "qwen2.5:7b",
        provider: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        input: ["text", "image"],
        contextWindow: 32_768,
      },
      { includeDetails: true },
    );
    const benefits = modelPickerBenefits(optionFromProjection(projected));
    expect(benefits.map((benefit) => benefit.title)).toContain("Vision");
  });
});

describe("formatModelPickerTag", () => {
  it("normalizes opaque gateway tags into readable labels", () => {
    expect(formatModelPickerTag("fallback3")).toBe("Fallback 3");
    expect(formatModelPickerTag("configured")).toBe("Configured");
    expect(formatModelPickerTag("custom-tag")).toBe("custom-tag");
  });
});

describe("modelUnavailableAction", () => {
  it("opens connect for missing-auth and auth-failed", () => {
    expect(modelUnavailableAction({ disabled: true, unavailableReason: "missing-auth" })).toBe(
      "connect-provider",
    );
    expect(modelUnavailableAction({ disabled: true, unavailableReason: "auth-failed" })).toBe(
      "connect-provider",
    );
  });

  it("stays inert for enabled models and other reasons", () => {
    expect(modelUnavailableAction({ disabled: false, unavailableReason: "missing-auth" })).toBe(
      null,
    );
    expect(modelUnavailableAction({ disabled: true, unavailableReason: "cooldown" })).toBe(null);
    expect(modelUnavailableAction({ disabled: true })).toBe(null);
  });
});
