/** Implementation of `openclaw models local`. */
import { normalizeProviderId } from "@openclaw/model-catalog-core/provider-id";
import type {
  ModelChoice,
  ModelsListParams,
} from "../../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { sanitizeTerminalText } from "../../../packages/terminal-core/src/safe-text.js";
import { colorize, theme } from "../../../packages/terminal-core/src/theme.js";
import {
  listConfiguredLocalProviders,
  probeConfiguredLocalProviders,
  resolveLocalProviderStartHint,
  type LocalProviderReachabilityResult,
} from "../../agents/local-provider-reachability.js";
import { modelKey } from "../../agents/model-ref-shared.js";
import { requestExitAfterOneShotOutput } from "../../cli/one-shot-exit.js";
import { getRuntimeConfig } from "../../config/config.js";
import { type RuntimeEnv, writeRuntimeJson, writeRuntimeStdout } from "../../runtime.js";
import { fetchPublishedModelsListResult } from "./list.fetch-result.js";
import { isRich, padTerminalCell } from "./list.format.js";
import { ensureFlagCompatibility } from "./shared.js";

export type ModelsLocalModelRow = {
  key: string;
  name: string;
  provider: string;
  reachable: boolean | null;
  resident: boolean | null;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
};

export type ModelsLocalRuntimeRow = {
  provider: string;
  baseUrl?: string;
  reachable: boolean | null;
  startHint: string;
  modelCount: number;
  residentCount: number;
  models: ModelsLocalModelRow[];
};

export type ModelsLocalResult = {
  runtimes: ModelsLocalRuntimeRow[];
  models: ModelsLocalModelRow[];
};

function outcomeReachable(
  outcomes: ReadonlyArray<{ provider: string; status: string }> | undefined,
  provider: string,
): boolean | null {
  const matches = outcomes?.filter(
    (outcome) => normalizeProviderId(outcome.provider) === normalizeProviderId(provider),
  );
  if (!matches?.length) {
    return null;
  }
  if (matches.some((outcome) => outcome.status === "ready")) {
    return true;
  }
  if (matches.every((outcome) => outcome.status === "unavailable")) {
    return false;
  }
  return null;
}

function toLocalModelRow(params: {
  model: ModelChoice;
  reachable: boolean | null;
}): ModelsLocalModelRow {
  const localModel = params.model.localModel;
  return {
    key: modelKey(params.model.provider, params.model.id),
    name: params.model.name,
    provider: normalizeProviderId(params.model.provider),
    reachable: params.reachable,
    resident: localModel?.resident ?? null,
    ...(localModel?.parameterSize ? { parameterSize: localModel.parameterSize } : {}),
    ...(localModel?.quantization ? { quantization: localModel.quantization } : {}),
    ...(typeof localModel?.sizeBytes === "number" ? { sizeBytes: localModel.sizeBytes } : {}),
  };
}

function mergeReachability(
  catalogReachable: boolean | null,
  probe: LocalProviderReachabilityResult | undefined,
): boolean | null {
  if (probe?.status === "reachable") {
    return true;
  }
  if (probe?.status === "unreachable") {
    return false;
  }
  return catalogReachable;
}

/** Builds the local-runtime inventory from published catalog rows and configured probes. */
export function buildModelsLocalResult(params: {
  models: readonly ModelChoice[];
  providerOutcomes?: ReadonlyArray<{ provider: string; status: string }>;
  probes?: readonly LocalProviderReachabilityResult[];
  configured?: ReadonlyArray<{
    provider: string;
    baseUrl: string;
    startHint: string;
  }>;
}): ModelsLocalResult {
  const probeByProvider = new Map(
    (params.probes ?? []).map((probe) => [normalizeProviderId(probe.provider), probe]),
  );
  const configuredByProvider = new Map(
    (params.configured ?? []).map((row) => [normalizeProviderId(row.provider), row]),
  );
  const localModels = params.models.filter((model) => model.local === true);
  const byProvider = new Map<string, ModelChoice[]>();
  for (const model of localModels) {
    const provider = normalizeProviderId(model.provider);
    const rows = byProvider.get(provider) ?? [];
    rows.push(model);
    byProvider.set(provider, rows);
  }
  for (const provider of configuredByProvider.keys()) {
    if (!byProvider.has(provider)) {
      byProvider.set(provider, []);
    }
  }
  const runtimes: ModelsLocalRuntimeRow[] = [...byProvider.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([provider, models]) => {
      const probe = probeByProvider.get(provider);
      const configured = configuredByProvider.get(provider);
      const reachable = mergeReachability(
        outcomeReachable(params.providerOutcomes, provider),
        probe,
      );
      const modelRows = models
        .map((model) => toLocalModelRow({ model, reachable }))
        .toSorted((left, right) => {
          const leftResident = left.resident === true ? 0 : 1;
          const rightResident = right.resident === true ? 0 : 1;
          return leftResident - rightResident || left.key.localeCompare(right.key);
        });
      return {
        provider,
        ...(configured?.baseUrl || probe?.baseUrl
          ? { baseUrl: configured?.baseUrl ?? probe?.baseUrl }
          : {}),
        reachable,
        startHint:
          probe?.startHint ?? configured?.startHint ?? resolveLocalProviderStartHint({ provider }),
        modelCount: modelRows.length,
        residentCount: modelRows.filter((model) => model.resident === true).length,
        models: modelRows,
      };
    });
  return {
    runtimes,
    models: runtimes.flatMap((runtime) => runtime.models),
  };
}

function printModelsLocalTable(result: ModelsLocalResult, runtime: RuntimeEnv): void {
  const rich = isRich({});
  if (result.runtimes.length === 0) {
    runtime.log("No local model runtimes found.");
    return;
  }
  const header = [
    padTerminalCell("Provider", 16),
    padTerminalCell("Reachable", 10),
    padTerminalCell("Models", 8),
    padTerminalCell("Warm", 6),
    "Start hint",
  ].join(" ");
  runtime.log(rich ? theme.heading(header) : header);
  for (const row of result.runtimes) {
    const reachableText = row.reachable === null ? "unknown" : row.reachable ? "yes" : "no";
    const line = [
      rich ? theme.accent(padTerminalCell(row.provider, 16)) : padTerminalCell(row.provider, 16),
      colorize(
        rich,
        row.reachable === null ? theme.muted : row.reachable ? theme.success : theme.error,
        padTerminalCell(reachableText, 10),
      ),
      padTerminalCell(String(row.modelCount), 8),
      padTerminalCell(String(row.residentCount), 6),
      sanitizeTerminalText(row.startHint),
    ].join(" ");
    runtime.log(line);
    for (const model of row.models) {
      const residentText = model.resident === null ? "-" : model.resident ? "warm" : "cold";
      const detail = [model.key, residentText, model.parameterSize, model.quantization]
        .filter(Boolean)
        .join("  ");
      runtime.log(`  ${sanitizeTerminalText(detail)}`);
    }
  }
}

export async function modelsLocalCommand(
  opts: {
    refresh?: boolean;
    agent?: string;
    json?: boolean;
    plain?: boolean;
  },
  runtime: RuntimeEnv,
): Promise<void> {
  ensureFlagCompatibility(opts);
  const listParams: ModelsListParams = {
    ...(opts.agent?.trim() ? { agentId: opts.agent.trim() } : {}),
    view: "all",
    includeDetails: true,
    ...(opts.refresh ? { refresh: true } : {}),
  };
  const catalog = await fetchPublishedModelsListResult({
    listParams,
    refresh: opts.refresh,
    runtime,
  });
  if (
    catalog.refreshFailed ||
    (opts.refresh && catalog.providerOutcomes?.some((outcome) => outcome.status !== "ready"))
  ) {
    runtime.error(
      "Model discovery could not refresh all providers. Showing available local catalog rows.",
    );
  }
  const cfg = getRuntimeConfig({ skipPluginValidation: true });
  const configured = listConfiguredLocalProviders(cfg).map((row) => ({
    provider: row.provider,
    baseUrl: row.baseUrl,
    startHint: resolveLocalProviderStartHint({
      provider: row.provider,
      providerConfig: row.providerConfig,
    }),
  }));
  const probes = configured.length > 0 ? await probeConfiguredLocalProviders(cfg) : [];
  const result = buildModelsLocalResult({
    models: catalog.models,
    providerOutcomes: catalog.providerOutcomes,
    probes,
    configured,
  });
  if (opts.json) {
    writeRuntimeJson(runtime, result);
  } else if (opts.plain) {
    for (const model of result.models) {
      writeRuntimeStdout(runtime, sanitizeTerminalText(model.key));
    }
  } else {
    printModelsLocalTable(result, runtime);
  }
  requestExitAfterOneShotOutput(runtime);
}
