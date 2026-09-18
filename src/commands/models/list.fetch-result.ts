/** Shared published-catalog fetch used by `models list` and `models local`. */
import type {
  ModelsListParams,
  ModelsListResult,
} from "../../../packages/gateway-protocol/src/schema/agents-models-skills.js";
import { GATEWAY_SERVER_CAPS } from "../../../packages/gateway-protocol/src/server-capabilities.js";
import { getRuntimeConfig } from "../../config/config.js";
import { callGateway, isImplicitLocalGatewayTarget } from "../../gateway/call.js";
import { readActiveGatewayLockIdentity } from "../../infra/gateway-lock.js";
import type { RuntimeEnv } from "../../runtime.js";
import { loadModelsConfigWithSource } from "./load-config.js";
import { resolveModelsTargetAgent } from "./shared.js";

// The catalog worker permits three minutes; leave room for connection and result projection.
export const MODEL_CATALOG_REFRESH_TIMEOUT_MS = 210_000;

/** Loads the published model catalog from a selected Gateway or the local cache. */
export async function fetchPublishedModelsListResult(params: {
  listParams: ModelsListParams;
  refresh?: boolean;
  runtime: RuntimeEnv;
}): Promise<ModelsListResult> {
  const cfg = getRuntimeConfig({ skipPluginValidation: true });
  const localTarget = await isImplicitLocalGatewayTarget({ config: cfg });
  const explicitPort = Boolean(process.env.OPENCLAW_GATEWAY_PORT?.trim());
  const gatewayOwner =
    localTarget && !explicitPort
      ? await readActiveGatewayLockIdentity({ requireInspection: true })
      : undefined;
  if (!localTarget || explicitPort || gatewayOwner) {
    return await callGateway<ModelsListResult>({
      config: cfg,
      method: "models.list",
      ...(params.refresh ? { timeoutMs: MODEL_CATALOG_REFRESH_TIMEOUT_MS } : {}),
      requiredCapabilities: [GATEWAY_SERVER_CAPS.PUBLISHED_MODEL_CATALOG],
      ...(gatewayOwner ? { localPortOverride: gatewayOwner.port } : {}),
      params: params.listParams,
    });
  }
  params.runtime.error(
    params.refresh
      ? "Gateway is not running. Refreshing the local model catalog."
      : "Gateway is not running. Showing the local cached model catalog. Use --refresh to discover provider models.",
  );
  const [
    { resolvePublishedModelCatalogOwner },
    { withPreparedModelCatalogOwner },
    { getPreparedModelRuntimeAuthMaterializations },
    { buildModelsListResult },
  ] = await Promise.all([
    import("../../agents/prepared-model-catalog-owner.js"),
    import("../../agents/prepared-model-catalog.js"),
    import("../../agents/prepared-model-runtime-auth.js"),
    import("../../gateway/server-methods/models-list-result.js"),
  ]);
  const { resolvedConfig: localConfig } = await loadModelsConfigWithSource({
    commandName: "models list",
    runtime: params.runtime,
  });
  const { agentId, agentDir } = resolveModelsTargetAgent(localConfig, params.listParams.agentId, {
    kind: "read",
  });
  return await withPreparedModelCatalogOwner(
    {
      agentId,
      agentDir,
      config: localConfig,
      readOnly: params.refresh !== true,
      ...(params.refresh ? { refreshFullCatalog: true } : {}),
    },
    async (snapshot) => {
      const owner = resolvePublishedModelCatalogOwner(snapshot);
      return await buildModelsListResult({
        source: {
          kind: "published",
          owner: {
            ...owner,
            authMaterializations: getPreparedModelRuntimeAuthMaterializations(snapshot),
          },
        },
        agentId,
        params: params.listParams,
      });
    },
  );
}
