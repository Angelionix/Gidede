/**
 * GET /api/v1/mechanics/stats
 * Возвращает статистику MechanicsDB (128 механик, 15 групп).
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { getMechanicsDBStats, getMechanicGroups } from "@/lib/mechanics-db";
import { UNAUTH } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  const stats = getMechanicsDBStats();
  const groups = getMechanicGroups();

  return NextResponse.json({
    ...stats,
    groups_list: groups,
    source: "SW.BAND «Карты геймдизайнера» (Книга 15)",
  });
}
