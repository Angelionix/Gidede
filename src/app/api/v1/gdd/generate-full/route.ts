/**
 * POST /api/v1/gdd/generate-full
 *
 * R6-01: This endpoint was a stub that returned a simplified 3-field response
 * without calling the canonical GDD generator. It now delegates to
 * /api/v1/gdd/generate (the single canonical generator) via internal fetch,
 * passing the same auth header and body. This ensures one source of truth
 * for GDD generation.
 *
 * Body: { project_id, target_format? | format?, use_ai? }
 *
 * Response: identical to /api/v1/gdd/generate.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, signAccessToken } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { isGddDocumentFormat, normalizeGddFormat } from "@/lib/contracts/stage-contracts";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    // Normalize and validate the format (same as /gdd/generate does).
    const normalizedFormat = normalizeGddFormat(body?.target_format ?? body?.format ?? "one_sheet");
    if (!isGddDocumentFormat(normalizedFormat)) {
      return VALIDATION_ERROR(`Неизвестный формат GDD: ${normalizedFormat}`);
    }

    // R6-01: delegate to the canonical /api/v1/gdd/generate endpoint via
    // internal fetch. This ensures one source of truth for GDD generation.
    const internalToken = signAccessToken(user.id, user.email);
    const baseUrl = `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000"}`;

    const response = await fetch(`${baseUrl}/api/v1/gdd/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        target_format: normalizedFormat,
        use_ai: body?.use_ai === true || body?.use_ai === "true",
      }),
      redirect: "manual",
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        detail = errBody?.detail || errBody?.message || detail;
      } catch { /* ignore */ }
      return NextResponse.json(
        { detail: `Canonical /gdd/generate failed: ${detail}` },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[gdd/generate-full] error:", error);
    return SERVER_ERROR();
  }
}
