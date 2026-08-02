/**
 * Gidede — Per-section LLM generation for GDD (Block 6, roadmap R6-06).
 *
 * Provides `generateSectionWithLlm` which calls the LLM to draft a single
 * GDD section. The result is ALWAYS marked `review_status: "needs_review"` —
 * LLM-generated content never becomes "accepted" automatically. The caller
 * (human designer) must explicitly review and approve it.
 *
 * Before R6-06, the GDD route only had a single `enrichGdd` call that
 * appended an `ai_insights` string to the profile — it did NOT generate
 * per-section content. This module enables future per-section generation
 * with proper review gating.
 */

import { getLlmClientForStage } from "@/lib/llm/default-client";

export interface LlmSectionRequest {
  sectionName: string;
  sectionDescription: string;
  projectName: string;
  genre: string;
  upstreamContext: string;
  language: string;
}

export interface LlmSectionResult {
  content: string;
  source: "llm";
  review_status: "needs_review";
  generated_by: string;
  generation_timestamp: string;
}

/**
 * Generate a single GDD section using the LLM.
 *
 * The result is always marked `source: "llm"` and `review_status: "needs_review"`.
 * It is never automatically accepted — the human designer must review and
 * approve it explicitly.
 *
 * Returns null when the LLM is unavailable or the response is too short.
 */
export async function generateSectionWithLlm(
  request: LlmSectionRequest,
): Promise<LlmSectionResult | null> {
  const client = await getLlmClientForStage("gdd");
  if (!client) return null;

  const prompt = buildSectionPrompt(request);

  try {
    const response = await client.createCompletion({
      messages: [
        {
          role: "system",
          content: request.language === "ru"
            ? "Ты — помощник геймдизайнера. Генерируй черновики секций GDD на основе upstream данных. Контент требует ревью дизайнера."
            : "You are a game design assistant. Generate GDD section drafts based on upstream data. Content requires designer review.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (content.length < 20) return null;

    return {
      content,
      source: "llm",
      review_status: "needs_review",
      generated_by: "glm-4.6",
      generation_timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function buildSectionPrompt(req: LlmSectionRequest): string {
  const lang = req.language === "ru" ? "ru" : "en";
  if (lang === "ru") {
    return [
      `Проект: ${req.projectName}`,
      `Жанр: ${req.genre}`,
      ``,
      `Контекст из upstream артефактов:`,
      req.upstreamContext,
      ``,
      `Задача: напиши секцию GDD «${req.sectionName}».`,
      `Описание секции: ${req.sectionDescription}`,
      ``,
      `Требования:`,
      `- 200-500 слов`,
      `- Чёткая структура с подзаголовками`,
      `- Опирайся на upstream данные, не выдумывай факты`,
      `- Это черновик — требует ревью дизайнера`,
    ].join("\n");
  }
  return [
    `Project: ${req.projectName}`,
    `Genre: ${req.genre}`,
    ``,
    `Upstream artifact context:`,
    req.upstreamContext,
    ``,
    `Task: write the GDD section "${req.sectionName}".`,
    `Section description: ${req.sectionDescription}`,
    ``,
    `Requirements:`,
    `- 200-500 words`,
    `- Clear structure with subheadings`,
    `- Reference upstream data, do not fabricate facts`,
    `- This is a draft — requires designer review`,
  ].join("\n");
}

/**
 * Check whether a section should use LLM generation.
 * Only template/placeholder sections with an upstream artifact are eligible —
 * auto_fill sections already have real data and don't need LLM.
 */
export function shouldUseLlmForSection(
  source: string,
  hasUpstreamArtifact: boolean,
  useAi: boolean,
): boolean {
  if (!useAi) return false;
  if (source === "auto_fill") return false;
  if (!hasUpstreamArtifact) return false;
  return source === "template" || source === "placeholder";
}
