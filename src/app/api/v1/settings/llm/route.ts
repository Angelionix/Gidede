import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseOpenAiCompatibleConfig, resolveServerSecret } from "@/lib/llm/config";
import { getCurrentUser } from "@/lib/server-auth";

function serialize(config: {
  adapter: string;
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  enabled: boolean;
}) {
  return {
    adapter: config.adapter,
    label: config.label,
    base_url: config.baseUrl,
    model: config.model,
    secret_ref: config.secretRef,
    secret_available: !config.secretRef || resolveServerSecret(config.secretRef) !== null,
    enabled: config.enabled,
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const config = await db.userLlmConfig.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ config: config ? serialize(config) : null });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  try {
    const body = await request.json();
    const config = parseOpenAiCompatibleConfig({
      label: body?.label,
      baseUrl: body?.base_url,
      model: body?.model,
      secretRef: body?.secret_ref,
      enabled: body?.enabled,
    });

    const saved = await db.userLlmConfig.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        adapter: "openai-compatible",
        ...config,
      },
      update: {
        adapter: "openai-compatible",
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
