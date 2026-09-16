import { materializeModelPolicyAllowlist } from "../config/model-policy-allowlist-migration.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resolveMutableAgentEntry } from "./agent-scope-config.js";
/**
 * Widens the active model-policy allowlist to cover one provider.
 *
 * The allowlist can live on an agent entry, on `agents.defaults`, or in the
 * legacy `agents.defaults.models` map, and it also scopes provider discovery.
 * Callers that need consented access to a provider share this writer so each
 * shape stays handled in one place.
 */
import { normalizeProviderId } from "./model-ref-shared.js";
import {
  LEGACY_MODEL_POLICY_ALLOW_CONFIG_PATH,
  resolveConfiguredModelPolicyAllow,
} from "./model-selection-shared.js";

const AGENT_MODEL_POLICY_ALLOW_PATH = "agents.entries.*.modelPolicy.allow";

/** Mutates `config` in place so `provider` is permitted, then returns it. */
export function applyModelPolicyProviderAllowance(
  config: OpenClawConfig,
  params: { provider: string; agentId: string },
): OpenClawConfig {
  const provider = normalizeProviderId(params.provider);
  const wildcard = `${provider}/*`;
  const policy = resolveConfiguredModelPolicyAllow({ cfg: config, agentId: params.agentId });
  if (policy.refs.includes(wildcard)) {
    return config;
  }
  const allow = [...policy.refs, wildcard];
  if (policy.repairConfigPath === AGENT_MODEL_POLICY_ALLOW_PATH) {
    const agent = resolveMutableAgentEntry(config, params.agentId);
    if (!agent) {
      throw new Error(`Agent "${params.agentId}" no longer exists.`);
    }
    agent.modelPolicy = { ...agent.modelPolicy, allow };
    return config;
  }
  config.agents ??= {};
  config.agents.defaults ??= {};
  const defaults = config.agents.defaults;
  // A deferred legacy allowlist keeps its dynamic map semantics; extend the map instead.
  if (
    policy.configPath === LEGACY_MODEL_POLICY_ALLOW_CONFIG_PATH &&
    materializeModelPolicyAllowlist(config).kind === "deferred"
  ) {
    defaults.models = { ...defaults.models, [wildcard]: {} };
    return config;
  }
  defaults.modelPolicy = { ...defaults.modelPolicy, allow };
  return config;
}
