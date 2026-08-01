import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  parseLlmRoutePolicy,
  serializeLlmRoutePolicy,
  type LlmRoutePolicy,
} from "@/lib/llm/routing";
import { getCurrentUser } from "@/lib/server-auth";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  try {
    const body = await request.json();
    if (!Array.isArray(body?.routes)) throw new Error("routes must be an array");
    const policies = body.routes.map(parseLlmRoutePolicy);
    const stages = new Set(policies.map((policy) => policy.stage));
    if (stages.size !== policies.length) throw new Error("routes contain duplicate stages");

    const configs = await db.userLlmConfig.findMany({ where: { userId: user.id }, select: { id: true } });
    const ownedConfigIds = new Set(configs.map((config) => config.id));
    for (const policy of policies) {
      for (const entry of policy.chain) {
        if (entry.configId !== "builtin" && !ownedConfigIds.has(entry.configId)) {
          throw new Error(`route ${policy.stage} references an unknown provider config`);
        }
      }
    }

    const operations = [
      db.userLlmRoute.deleteMany({
        where: {
          userId: user.id,
          ...(policies.length > 0 ? { stage: { notIn: policies.map((policy) => policy.stage) } } : {}),
        },
      }),
      ...policies.map((policy) => db.userLlmRoute.upsert({
        where: { userId_stage: { userId: user.id, stage: policy.stage } },
        create: routeData(user.id, policy),
        update: routeData(user.id, policy),
      })),
    ];
    await db.$transaction(operations);
    return NextResponse.json({ routes: policies.map(serializeLlmRoutePolicy) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Некорректная LLM route policy";
    return NextResponse.json({ detail }, { status: 422 });
  }
}

function routeData(userId: string, policy: LlmRoutePolicy) {
  return {
    userId,
    stage: policy.stage,
    chainJson: JSON.stringify(
      policy.chain.map((entry) => ({ config_id: entry.configId, model: entry.model })),
    ),
    temperature: policy.temperature,
    maxOutputTokens: policy.maxOutputTokens,
  };
}
