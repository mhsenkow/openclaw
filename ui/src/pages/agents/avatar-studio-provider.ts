// Connect a hosted image provider for Avatar Studio and set the default image model.
import type { GatewayBrowserClient } from "../../api/gateway.ts";
import type { RuntimeConfigCapability } from "../../lib/config/runtime-config-capability.ts";

export type ConnectAvatarImageProviderParams = {
  client: GatewayBrowserClient;
  runtimeConfig: RuntimeConfigCapability;
  agentId: string;
  provider: string;
  apiKey: string;
  model: string;
  canDispatch: () => boolean;
};

/** Save the provider API key and point mediaModels.image at a Flux (or similar) ref. */
export async function connectAvatarImageProvider(
  params: ConnectAvatarImageProviderParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    return { ok: false, error: "Paste an API key to continue." };
  }
  try {
    const mutation = await params.runtimeConfig.runExternalMutation(
      async (client) => {
        if (client !== params.client) {
          throw new Error("Connection changed before the image provider update started.");
        }
        await client.request("models.authSetApiKey", {
          provider: params.provider,
          apiKey,
          agentId: params.agentId,
        });
        params.runtimeConfig.patchForm(["agents", "defaults", "mediaModels", "image"], {
          primary: params.model,
        });
        const saved = await params.runtimeConfig.save({
          canDispatch: params.canDispatch,
        });
        if (!saved) {
          throw new Error("Could not save the image model default.");
        }
      },
      {
        canDispatch: params.canDispatch,
        dispatchError: "Access changed before the image provider update started.",
      },
    );
    if (!mutation.ok) {
      return { ok: false, error: mutation.error };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
