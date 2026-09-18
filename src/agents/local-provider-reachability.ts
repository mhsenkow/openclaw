/**
 * Read-only reachability probes and start hints for configured local model providers.
 * Does not start servers or trigger model loads.
 */
import { normalizeProviderId } from "@openclaw/model-catalog-core/provider-id";
import { normalizeLowercaseStringOrEmpty } from "@openclaw/normalization-core/string-coerce";
import { resolveMergedModelProviderConfig } from "../config/model-provider-config.js";
import type {
  ModelProviderConfig,
  ModelProviderLocalServiceConfig,
} from "../config/types.models.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { formatErrorMessageWithCode } from "../infra/errors.js";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import type { SsrFPolicy } from "../infra/net/ssrf.js";
import { isLocalProviderBaseUrl } from "./model-provider-local.js";

const REACHABILITY_TIMEOUT_MS = 2_500;

type ProbeApi = "ollama" | "openai-completions" | "openai-responses";

export type LocalProviderReachabilityStatus = "reachable" | "unreachable" | "skipped";

export type LocalProviderReachabilityResult = {
  provider: string;
  baseUrl: string;
  status: LocalProviderReachabilityStatus;
  startHint: string;
  error?: string;
};

/** Exact operator start commands for known local runtimes. */
const KNOWN_LOCAL_PROVIDER_START_HINTS: Readonly<Record<string, string>> = {
  ollama: "ollama serve",
  lmstudio: "lms server start",
  vllm: "vllm serve <model-id>",
  sglang: "python -m sglang.launch_server",
  "llama-cpp": "openclaw onboard  # choose Managed local server, or start llama-server",
};

function normalizeBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : undefined;
}

function normalizeProbeApi(providerConfig: ModelProviderConfig): ProbeApi | undefined {
  const api = normalizeLowercaseStringOrEmpty(providerConfig.api);
  if (api === "ollama" || api === "openai-completions" || api === "openai-responses") {
    return api;
  }
  return undefined;
}

function buildProbeUrl(api: ProbeApi, baseUrl: string): string {
  if (api === "ollama") {
    return `${baseUrl}/api/tags`;
  }
  return `${baseUrl}/models`;
}

function buildLocalProviderSsrFPolicy(baseUrl: string): SsrFPolicy | undefined {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return {
      hostnameAllowlist: [parsed.hostname],
      allowPrivateNetwork: true,
    };
  } catch {
    return undefined;
  }
}

function formatLocalServiceStartHint(localService: ModelProviderLocalServiceConfig): string {
  const args = localService.args?.length
    ? ` ${localService.args.map((arg) => (/\s/u.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`
    : "";
  return `${localService.command}${args}`;
}

/** Returns an actionable start command for a configured local provider. */
export function resolveLocalProviderStartHint(params: {
  provider: string;
  providerConfig?: ModelProviderConfig;
}): string {
  const localService = params.providerConfig?.localService;
  if (localService?.command) {
    return formatLocalServiceStartHint(localService);
  }
  const known = KNOWN_LOCAL_PROVIDER_START_HINTS[normalizeProviderId(params.provider)];
  if (known) {
    return known;
  }
  const baseUrl = normalizeBaseUrl(params.providerConfig?.baseUrl);
  return baseUrl
    ? `Start the local server listening at ${baseUrl}`
    : `Start the local ${params.provider} server`;
}

/** Lists configured providers that use a local base URL or localService. */
export function listConfiguredLocalProviders(cfg: OpenClawConfig): Array<{
  provider: string;
  providerConfig: ModelProviderConfig;
  baseUrl: string;
}> {
  const providers = cfg.models?.providers;
  if (!providers) {
    return [];
  }
  const rows: Array<{
    provider: string;
    providerConfig: ModelProviderConfig;
    baseUrl: string;
  }> = [];
  for (const providerId of Object.keys(providers)) {
    const providerConfig = resolveMergedModelProviderConfig(cfg, providerId);
    if (!providerConfig) {
      continue;
    }
    const baseUrl = normalizeBaseUrl(providerConfig.baseUrl);
    const healthUrl = normalizeBaseUrl(providerConfig.localService?.healthUrl);
    const hasLocalService = providerConfig.localService !== undefined;
    const localByUrl = baseUrl ? isLocalProviderBaseUrl(baseUrl) : false;
    if (!localByUrl && !hasLocalService) {
      continue;
    }
    const reportedBaseUrl = baseUrl ?? healthUrl;
    if (!reportedBaseUrl) {
      continue;
    }
    rows.push({
      provider: normalizeProviderId(providerId),
      providerConfig,
      baseUrl: reportedBaseUrl,
    });
  }
  return rows.toSorted((left, right) => left.provider.localeCompare(right.provider));
}

async function probeLocalProviderEndpoint(params: {
  api: ProbeApi;
  baseUrl: string;
}): Promise<void> {
  const { response, release } = await fetchWithSsrFGuard({
    url: buildProbeUrl(params.api, params.baseUrl),
    init: { method: "GET" },
    policy: buildLocalProviderSsrFPolicy(params.baseUrl),
    timeoutMs: REACHABILITY_TIMEOUT_MS,
    auditContext: "local-provider-reachability",
  });
  try {
    void response.status;
  } finally {
    if (!response.bodyUsed) {
      void response.body?.cancel().catch(() => undefined);
    }
    await release();
  }
}

/** Probes one configured local provider endpoint without starting it. */
export async function probeConfiguredLocalProvider(params: {
  provider: string;
  providerConfig: ModelProviderConfig;
  baseUrl: string;
}): Promise<LocalProviderReachabilityResult> {
  const startHint = resolveLocalProviderStartHint({
    provider: params.provider,
    providerConfig: params.providerConfig,
  });
  const healthUrl = normalizeBaseUrl(params.providerConfig.localService?.healthUrl);
  try {
    if (healthUrl) {
      const { response, release } = await fetchWithSsrFGuard({
        url: healthUrl,
        init: { method: "GET" },
        policy: buildLocalProviderSsrFPolicy(healthUrl),
        timeoutMs: REACHABILITY_TIMEOUT_MS,
        auditContext: "local-provider-reachability",
      });
      try {
        void response.status;
      } finally {
        if (!response.bodyUsed) {
          void response.body?.cancel().catch(() => undefined);
        }
        await release();
      }
    } else {
      const api = normalizeProbeApi(params.providerConfig) ?? "openai-completions";
      await probeLocalProviderEndpoint({ api, baseUrl: params.baseUrl });
    }
    return {
      provider: params.provider,
      baseUrl: params.baseUrl,
      status: "reachable",
      startHint,
    };
  } catch (error) {
    return {
      provider: params.provider,
      baseUrl: params.baseUrl,
      status: "unreachable",
      startHint,
      error: formatErrorMessageWithCode(error),
    };
  }
}

/** Probes every configured local provider for doctor and CLI reporting. */
export async function probeConfiguredLocalProviders(
  cfg: OpenClawConfig,
): Promise<readonly LocalProviderReachabilityResult[]> {
  const providers = listConfiguredLocalProviders(cfg);
  return await Promise.all(
    providers.map((row) =>
      probeConfiguredLocalProvider({
        provider: row.provider,
        providerConfig: row.providerConfig,
        baseUrl: row.baseUrl,
      }),
    ),
  );
}
