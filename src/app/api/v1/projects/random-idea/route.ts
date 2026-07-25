/**
 * GET /api/v1/projects/random-idea
 *
 * Generates a creative random project idea using the AI (z-ai-web-dev-sdk,
 * glm-4.6). Falls back to the deterministic generator if AI is unavailable
 * or the user has exceeded their AI quota.
 *
 * Response: { name, description, genre, subgenres[], source }
 *   source: "ai" | "deterministic"
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { generateRandomProject } from "@/lib/project-generator";
import { checkAiQuota, incrementAiUsage } from "@/lib/ai-quota";
import { db } from "@/lib/db";
import { GENRES } from "@/config/genres";
import type ZAI from "z-ai-web-dev-sdk";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    // Check AI quota — if exhausted, fall back to deterministic.
    const quota = await checkAiQuota(user);
    if (!quota.allowed) {
      const idea = generateRandomProject();
      return NextResponse.json({ ...idea, subgenres: [], source: "deterministic" });
    }

    // Try AI generation
    let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
    try {
      zai = await ZAI.create();
    } catch {
      // SDK unavailable — fall back
    }

    if (zai) {
      try {
        const genreList = GENRES.map((g) => g.label).join(", ");
        const prompt = `Ты — генератор игровых концепций. Создай ОДНУ креативную и неожиданную идею для игры. Ответь ТОЛЬКО валидным JSON без markdown, без комментариев, без \`\`\`json блоков.

Формат ответа:
{
  "name": "Название игры (короткое, запоминающееся, на русском)",
  "description": "1-3 предложения описания идеи (на русском)",
  "genre": "один из: ${genreList}",
  "subgenres": ["1-3 уточняющих под-жанра из того же списка"]
}

Требования:
- Будь креативным: необычные сеттинги, нестандартные механики
- Избегай клише (избегай банальных "фэнтези с эльфами" или "киберпанк с хакерами")
- Название должно быть коротким (1-4 слова)
- Описание должно быть конкретным (упомяни ключевую механику)
- Жанр и под-жанры из списка выше`;

        const response = await zai.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "Ты — креативный генератор игровых концепций. Отвечаешь только валидным JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 400,
          thinking: { type: "disabled" },
        });

        const rawText = response.choices?.[0]?.message?.content || "";

        // Extract JSON from the response (handles ```json blocks too)
        let jsonStr = rawText.trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr) as {
          name?: string;
          description?: string;
          genre?: string;
          subgenres?: string[];
        };

        if (parsed.name && parsed.description) {
          // Charge the AI call
          await incrementAiUsage(user.id).catch(() => {});

          // Validate genre against known list (case-insensitive match by label)
          const genreValue = GENRES.find(
            (g) =>
              g.label.toLowerCase() === String(parsed.genre).toLowerCase() ||
              g.value.toLowerCase() === String(parsed.genre).toLowerCase()
          )?.value;

          // Validate subgenres
          const subgenres = Array.isArray(parsed.subgenres)
            ? parsed.subgenres
                .filter((s) => typeof s === "string")
                .map((s) => {
                  const found = GENRES.find(
                    (g) =>
                      g.label.toLowerCase() === s.toLowerCase() ||
                      g.value.toLowerCase() === s.toLowerCase()
                  );
                  return found?.value || s;
                })
                .slice(0, 3)
            : [];

          return NextResponse.json({
            name: parsed.name.trim(),
            description: parsed.description.trim(),
            genre: genreValue || parsed.genre || "action",
            subgenres,
            source: "ai",
          });
        }
      } catch (e) {
        console.error("[random-idea] AI generation failed:", e);
        // Fall through to deterministic
      }
    }

    // Fallback: deterministic generator
    const idea = generateRandomProject();
    return NextResponse.json({ ...idea, subgenres: [], source: "deterministic" });
  } catch (error) {
    console.error("[random-idea] error:", error);
    return SERVER_ERROR();
  }
}
