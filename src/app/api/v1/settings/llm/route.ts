import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  listConfiguredLlmAdapters,
  normalizeConfiguredLlmOptions,
} from "@/lib/llm/configured-adapters";
import { parseOpenAiCompatibleConfig, resolveServerSecret } from "@/lib/llm/config";
import { getCurrentUser } from "@/lib/server-auth";

function serialize(config: {
  adapter: string;
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  configJson: string | null;
  enabled: boolean;
}) {
  return {
    adapter: config.adapter,
    label: config.label,
    base_url: config.baseUrl,
    model: config.model,
    secret_ref: config.secretRef,
    config_json: config.configJson ? JSON.parse(config.configJson) : null,
    secret_available: !config.secretRef || resolveServerSecret(config.secretRef) !== null,
    enabled: config.enabled,
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const config = await db.userLlmConfig.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    adapters: listConfiguredLlmAdapters(),
    config: config ? serialize(config) : null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  try {
    const body = await request.json();
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

    const saved = await db.userLlmConfig.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        adapter,
        configJson,
        ...config,
      },
      update: {
        adapter,
        configJson,
        ...config,
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

  await db.userLlmConfig.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ deleted: true });
}
