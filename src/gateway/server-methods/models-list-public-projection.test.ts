import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "../../agents/model-catalog.types.js";
import { buildPublicModelProjection } from "./models-list-public-projection.js";

const localOllama: ModelCatalogEntry = {
  id: "qwen2.5:7b",
  name: "qwen2.5:7b",
  provider: "ollama",
  baseUrl: "http://127.0.0.1:11434",
  input: ["text", "image"],
  contextWindow: 32_768,
  contextTokens: 16_384,
};

describe("buildPublicModelProjection", () => {
  // The Control UI historically omitted includeDetails, so local must not depend
  // on that flag. Native apps already request details; the web UI must still
  // learn "Runs locally" without them.
  it("projects local for a loopback baseUrl without includeDetails", () => {
    const projected = buildPublicModelProjection(localOllama);
    expect(projected.local).toBe(true);
    expect(projected.localModel).toBeUndefined();
  });

  it("keeps heavier detail fields behind includeDetails", () => {
    const without = buildPublicModelProjection(localOllama);
    expect(without.input).toBeUndefined();
    expect(without.contextTokens).toBeUndefined();

    const withDetails = buildPublicModelProjection(localOllama, { includeDetails: true });
    expect(withDetails.input).toEqual(["text", "image"]);
    expect(withDetails.contextTokens).toBe(16_384);
    expect(withDetails.local).toBe(true);
  });

  it("projects localModel facts only with includeDetails", () => {
    const entry = {
      ...localOllama,
      localModel: {
        sizeBytes: 4_000_000_000,
        parameterSize: "7B",
        quantization: "Q4_K_M",
        family: "qwen2",
        resident: true,
      },
    };
    expect(buildPublicModelProjection(entry).localModel).toBeUndefined();
    expect(buildPublicModelProjection(entry).local).toBe(true);
    expect(buildPublicModelProjection(entry, { includeDetails: true }).localModel).toEqual(
      entry.localModel,
    );
  });
});
