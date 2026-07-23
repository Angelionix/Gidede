/**
 * POST /api/v1/gbe/test-connection
 *
 * Tests connection to the GDCombine backend. Since there's no real GBE
 * running in this sandbox, we return a mock-but-realistic success response
 * with a small latency and a mock version string.
 *
 * Body: { base_url?: string, api_key?: string }
 *
 * Response (merged spec + frontend):
 *   {
 *     connected: boolean,             // both
 *     endpoint: string,                // spec
 *     base_url: string,                // frontend
 *     version?: string,                // spec
 *     gbe_version: string | null,      // frontend
 *     latency_ms: number,              // both
 *     is_mock: boolean,                // frontend
 *     message: string                  // frontend
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { GBE_VERSION } from "@/lib/gbe-store";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl =
      body?.base_url?.toString().trim() ||
      "https://gbe.example.com/api/v1";
    const apiKey = body?.api_key?.toString().trim() || "";

    // Simulate latency (mock connection always succeeds in this sandbox)
    const startedAt = Date.now();
    await new Promise((r) => setTimeout(r, 30));
    const latencyMs = Date.now() - startedAt + 12; // small mock latency

    const connected = true; // mock — always connected
    const message = connected
      ? `Соединение с GBE установлено (mock-режим, endpoint=${baseUrl}).`
      : "Не удалось подключиться к GBE.";

    return NextResponse.json({
      // spec fields
      connected,
      endpoint: baseUrl,
      version: GBE_VERSION,
      latency_ms: latencyMs,
      // frontend fields
      base_url: baseUrl,
      is_mock: true,
      gbe_version: GBE_VERSION,
      message,
    });
  } catch (error) {
    console.error("[gbe/test-connection] error:", error);
    return SERVER_ERROR();
  }
}
