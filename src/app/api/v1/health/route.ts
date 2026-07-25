/**
 * GET /api/v1/health
 * Health check endpoint.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "gidede-api",
    version: "0.51.0",
    timestamp: new Date().toISOString(),
    backend: "nextjs-api-routes",
  });
}
