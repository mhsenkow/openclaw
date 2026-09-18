/** Reads the selected Gateway catalog or an explicitly identified local published view. */
import { normalizeProviderId } from "@openclaw/model-catalog-core/provider-id";
import type {
  ModelChoice,
  ModelsListParams,
} from "../../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { sanitizeTerminalText } from "../../../packages/terminal-core/src/safe-text.js";
import { modelKey } from "../../agents/model-ref-shared.js";
import { ExpectedCliError } from "../../cli/failure-output.js";
import { requestExitAfterOneShotOutput } from "../../cli/one-shot-exit.js";
import type { RuntimeEnv } from "../../runtime.js";
import { fetchPublishedModelsListResult } from "./list.fetch-result.js";
import { printModelTable } from "./list.table.js";
import type { ModelRow } from "./list.types.js";
import { ensureFlagCompatibility } from "./shared.js";

export function toCliModelRow(model: ModelChoice): ModelRow {
  const tags = [
    ...new Set([...(model.tags ?? []), ...(model.alias ? [`alias:${model.alias}`] : [])]),
  ];
  if (model.localModel?.resident === true && !tags.includes("warm")) {
    tags.push("warm");
  }
  return {
    key: modelKey(model.provider, model.id),
    name: model.name,
    input: model.input?.join("+") || "-",
    contextWindow: model.contextWindow ?? null,
    ...(model.contextTokens !== undefined ? { contextTokens: model.contextTokens } : {}),
    local: model.local ?? null,
    available: model.available ?? null,
    ...(model.localModel ? { localModel: { ...model.localModel } } : {}),
    tags,
  };
}

function matchesLocalFilters(
  model: ModelChoice,
  opts: { local?: boolean; resident?: boolean },
): boolean {
  if (opts.local && model.local !== true) {
    return false;
  }
  if (opts.resident && model.localModel?.resident !== true) {
    return false;
  }
  return true;
}

export async function modelsListCommand(
  opts: {
    all?: boolean;
    refresh?: boolean;
    local?: boolean;
    resident?: boolean;
    provider?: string;
    agent?: string;
    json?: boolean;
    plain?: boolean;
  },
  runtime: RuntimeEnv,
) {
  ensureFlagCompatibility(opts);
  const rawProvider = opts.provider?.trim();
  if (rawProvider && /\s/u.test(rawProvider)) {
    const message = `Invalid provider filter "${sanitizeTerminalText(rawProvider)}". Use a provider id such as "moonshot", not a display label.`;
    throw new ExpectedCliError({ message, humanOutput: message, machineOutput: message });
  }
  const provider = rawProvider ? normalizeProviderId(rawProvider) : undefined;
  const local = Boolean(opts.local || opts.resident);
  const params: ModelsListParams = {
    ...(opts.agent?.trim() ? { agentId: opts.agent.trim() } : {}),
    view: opts.all || provider ? "all" : "default",
    ...(provider ? { provider } : {}),
    includeDetails: true,
    ...(opts.refresh ? { refresh: true } : {}),
  };
  const result = await fetchPublishedModelsListResult({
    listParams: params,
    refresh: opts.refresh,
    runtime,
  });
  if (
    result.refreshFailed ||
    (opts.refresh && result.providerOutcomes?.some((outcome) => outcome.status !== "ready"))
  ) {
    runtime.error(
      "Model discovery could not refresh all providers. Showing the available published model list.",
    );
  }
  const discoveryScope = result.modelPolicyDiscoveryScope;
  if (discoveryScope && !opts.json && !opts.plain) {
    const skipped = discoveryScope.skippedProviders;
    const allowPath = opts.agent?.trim()
      ? discoveryScope.repairConfigPath.replace("*", opts.agent.trim())
      : discoveryScope.repairConfigPath;
    runtime.error(
      `Model restrictions at ${discoveryScope.configPath} do not list ${skipped.join(", ")}. ` +
        `Configured ${skipped.length === 1 ? "provider" : "providers"} outside that list ${
          skipped.length === 1 ? "is" : "are"
        } not discovered, so ${skipped.length === 1 ? "its" : "their"} models never appear here. ` +
        `Add ${skipped.map((skippedProvider) => `"${skippedProvider}/*"`).join(", ")} to ${allowPath} to discover them.`,
    );
  }
  const rows = result.models
    .filter((model) => matchesLocalFilters(model, { local, resident: opts.resident }))
    .map(toCliModelRow);
  if (rows.length === 0 && !opts.json && !opts.plain) {
    runtime.log("No models found.");
  } else {
    printModelTable(rows, runtime, opts);
  }
  requestExitAfterOneShotOutput(runtime);
}
