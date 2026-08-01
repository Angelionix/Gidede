import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  listConfiguredLlmAdapters,
  normalizeConfiguredLlmOptions,
} from "@/lib/llm/configured-adapters";
import { parseOpenAiCompatibleConfig } from "@/lib/llm/config";
import {
  clientSafeLlmSecretStatus,
  isLlmSecretEncryptionAvailable,
  selectPersistedLlmSecret,
} from "@/lib/llm/secret-storage";
import { getCurrentUser } from "@/lib/server-auth";

function serialize(config: {
  id: string;
  adapter: string;
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  configJson: string | null;
  enabled: boolean;
}) {
  return {
    id: config.id,
    adapter: config.adapter,
    label: config.label,
    base_url: config.baseUrl,
    model: config.model,
    ...clientSafeLlmSecretStatus(config.secretRef),
    config_json: config.configJson ? JSON.parse(config.configJson) : null,
    enabled: config.enabled,
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const [configs, routes] = await Promise.all([
    db.userLlmConfig.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.userLlmRoute.findMany({ where: { userId: user.id }, orderBy: { stage: "asc" } }),
  ]);
  return NextResponse.json({
    adapters: listConfiguredLlmAdapters(),
    secret_encryption_available: isLlmSecretEncryptionAvailable(),
    configs: configs.map(serialize),
    routes: routes.map((route) => ({
      stage: route.stage,
      chain: JSON.parse(route.chainJson),
      temperature: route.temperature,
      max_output_tokens: route.maxOutputTokens,
    })),
    // Compatibility for clients created before multi-provider routing.
    config: configs[0] ? serialize(configs[0]) : null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  try {
    const body = await request.json();
    const configId = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : null;
    const adapter = typeof body?.adapter === "string" ? body.adapter.trim() : "openai-compatible";
    const config = parseOpenAiCompatibleConfig({
      label: body?.label,
      baseUrl: body?.base_url,
      model: body?.model,
      secretRef: body?.secret_ref,
      enabled: body?.enabled,
    });
    const normalizedOptions = normalizeConfiguredLlmOptions(adapter, body?.config_json);
    const configJson = normalizedOptions == null ? null : JSON.stringify(normalizedOptions);
    if (configJson && configJson.length > 20_000) {
      throw new Error("config_json is too large");
    }
    const existing = configId
      ? await db.userLlmConfig.findFirst({ where: { id: configId, userId: user.id } })
      : null;
    if (configId && !existing) {
      return NextResponse.json({ detail: "LLM-router не найден" }, { status: 404 });
    }
    const secretRef = selectPersistedLlmSecret({
      existingSecretRef: existing?.secretRef ?? null,
      environmentSecretRef: config.secretRef,
      plaintextSecret: body?.api_key,
      clearSecret: body?.clear_secret === true,
    });

    const data = {
      adapter,
      configJson,
      ...config,
      secretRef,
    };
    const saved = existing
      ? await db.userLlmConfig.update({ where: { id: existing.id }, data })
      : await db.userLlmConfig.create({
        data: {
          userId: user.id,
          ...data,
        },
      });

    return NextResponse.json({ config: serialize(saved) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Некорректная конфигурация";
    return NextResponse.json({ detail }, { status: 422 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const configId = new URL(request.url).searchParams.get("id")?.trim();
  if (!configId) {
    await db.$transaction([
      db.userLlmRoute.deleteMany({ where: { userId: user.id } }),
      db.userLlmConfig.deleteMany({ where: { userId: user.id } }),
    ]);
    return NextResponse.json({ deleted: true });
  }

  const config = await db.userLlmConfig.findFirst({ where: { id: configId, userId: user.id } });
  if (!config) return NextResponse.json({ detail: "LLM-router не найден" }, { status: 404 });
  const routes = await db.userLlmRoute.findMany({ where: { userId: user.id } });
  const routeOperations = routes.map((route) => {
    const chain = (JSON.parse(route.chainJson) as Array<{ config_id?: string; configId?: string }>)
      .filter((entry) => (entry.config_id ?? entry.configId) !== configId);
    return chain.length === 0
      ? db.userLlmRoute.delete({ where: { id: route.id } })
      : db.userLlmRoute.update({ where: { id: route.id }, data: { chainJson: JSON.stringify(chain) } });
  });
  await db.$transaction([
    ...routeOperations,
    db.userLlmConfig.delete({ where: { id: configId } }),
  ]);
  return NextResponse.json({ deleted: true, id: configId });
}
