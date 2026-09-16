/**
 * Diagnoses configured model providers that the active policy allowlist keeps
 * out of live discovery.
 *
 * `modelPolicy.allow` scopes `providerDiscoveryProviderIds`, so a configured
 * provider the allowlist never names is not contacted at all. The resulting
 * catalog is empty rather than filtered, which makes the omission invisible to
 * views that do not apply the policy themselves.
 */
import { parseModelCatalogRef } from "@openclaw/model-catalog-core/model-catalog-refs";
import { normalizeProviderId } from "@openclaw/model-catalog-core/provider-id";
import type { ModelPolicyDiscoveryScope } from "../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { parseModelPolicyWildcardRef } from "../config/model-policy-ref.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveConfiguredModelPolicyAllow } from "./model-selection-shared.js";

/** Providers an allowlist ref attributes to, ignoring alias-only selectors. */
function resolveModelPolicyRefProvider(
  raw: string,
  normalizeProvider: (provider: string) => string,
): string | undefined {
  const wildcard = parseModelPolicyWildcardRef(raw);
  if (wildcard) {
    return normalizeProvider(wildcard.provider);
  }
  const exact = parseModelCatalogRef(raw.trim());
  return exact ? normalizeProvider(exact.provider) : undefined;
}

export function resolveModelPolicyDiscoveryScope(params: {
  cfg: OpenClawConfig;
  agentId?: string;
  /** Provider ids the operator configured under `models.providers`. */
  configuredProviders: readonly string[];
  /** Catalog-aware normalizer so plugin provider aliases compare equal. */
  normalizeProvider?: (provider: string) => string;
}): ModelPolicyDiscoveryScope | undefined {
  const normalizeProvider = params.normalizeProvider ?? normalizeProviderId;
  const policy = resolveConfiguredModelPolicyAllow({
    cfg: params.cfg,
    agentId: params.agentId,
  });
  // An absent or empty allowlist imposes no discovery scope.
  if (policy.refs.length === 0 || !policy.configPath) {
    return undefined;
  }
  const allowedProviders = new Set(
    policy.refs
      .map((ref) => resolveModelPolicyRefProvider(ref, normalizeProvider))
      .filter((provider): provider is string => Boolean(provider)),
  );
  const skippedProviders = [
    ...new Set(
      params.configuredProviders
        .map((provider) => normalizeProvider(provider))
        .filter((provider) => provider && !allowedProviders.has(provider)),
    ),
  ].toSorted();
  return skippedProviders.length > 0
    ? {
        configPath: policy.configPath,
        repairConfigPath: policy.repairConfigPath,
        skippedProviders,
      }
    : undefined;
}
