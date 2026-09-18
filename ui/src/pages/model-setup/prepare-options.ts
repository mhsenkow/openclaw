import type { SystemAgentSetupDetectResult } from "../../api/types.ts";

export type ModelSetupPrepareOption = {
  id: string;
  brandId?: string;
  label: string;
  hint?: string;
  actionLabel?: string;
  icon?: string;
  website?: string;
  modelTarget?: "utility";
};

function providerAutoSetupKind(choiceId: string): `provider-auto:${string}` {
  return `provider-auto:${encodeURIComponent(choiceId)}`;
}

/** Local runtime candidates already discovered by Gateway prepare/auth probes. */
export function isLocalRuntimeCandidate(
  candidate: SystemAgentSetupDetectResult["candidates"][number],
  prepareOptions: SystemAgentSetupDetectResult["prepareOptions"],
): boolean {
  if (candidate.kind.startsWith("provider-auto:")) {
    return true;
  }
  const advertised = new Set(
    (prepareOptions ?? []).flatMap((option) =>
      [option.brandId, option.id].filter((value): value is string => Boolean(value)),
    ),
  );
  if (candidate.brandId && advertised.has(candidate.brandId)) {
    return true;
  }
  const providerId = candidate.modelRef.split("/")[0];
  return Boolean(providerId && advertised.has(providerId));
}

export function preparedModelActivation(option: ModelSetupPrepareOption, modelRef: string) {
  return {
    kind: providerAutoSetupKind(option.id),
    modelRef,
    ...(option.modelTarget ? { modelTarget: option.modelTarget } : {}),
  };
}

/**
 * Gateway-advertised local prepare rows only. Older Gateways omit prepareOptions;
 * callers must say so explicitly instead of inventing a stale Ollama/llama.cpp list.
 */
export function listModelSetupPrepareOptions(
  result: SystemAgentSetupDetectResult,
): ModelSetupPrepareOption[] {
  return (result.prepareOptions ?? []).filter(
    (choice) =>
      !result.candidates.some(
        (candidate) =>
          candidate.credentials !== false &&
          (candidate.kind === providerAutoSetupKind(choice.id) ||
            candidate.modelRef.startsWith(`${choice.brandId ?? choice.id}/`)),
      ),
  );
}

export function findPreparedModelCandidate(result: SystemAgentSetupDetectResult, choiceId: string) {
  // Detection deliberately encodes the provider-auth choice ID in the kind;
  // brandId owns the model-ref namespace and may differ.
  return result.candidates.find(
    (candidate) =>
      candidate.kind === providerAutoSetupKind(choiceId) && candidate.credentials !== false,
  );
}
