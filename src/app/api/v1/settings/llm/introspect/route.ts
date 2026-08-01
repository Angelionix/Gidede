import { NextRequest, NextResponse } from "next/server";
import { getDefaultLlmClient } from "@/lib/llm/default-client";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const client = await getDefaultLlmClient();
  if (!client) {
    return NextResponse.json({
      detail: "LLM provider не инициализирован",
    }, { status: 503 });
  }

  const capabilities = client.getCapabilities();
  const health = await client.healthCheck();
  let models: Awaited<ReturnType<typeof client.listModels>> = [];
  let modelsError: string | null = null;
  if (capabilities.modelDiscovery) {
    try {
      models = await client.listModels();
    } catch {
      modelsError = "model_discovery_failed";
    }
  }

  return NextResponse.json({
    provider: client.providerId,
    configured_model: client.modelId,
    capabilities,
    health,
    models,
    models_error: modelsError,
  });
}
