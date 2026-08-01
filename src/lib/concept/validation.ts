/**
 * Gidede — Concept validation logic (Block 1, algorithm 3.1 stage 6).
 *
 * TASK-1.3 + TASK-1.4 + TASK-1.5: вынесено из /concept/generate/route.ts
 * в общий модуль, чтобы /concept/[id]/validate мог переиспользовать ту же логику.
 *
 * Реализует:
 *   - Triangle of Weirdness (weird + appealing + credible)
 *   - 5 core questions (core verb, moment-to-moment, long-term goal, fun source, return reason)
 *   - 8 idea filters (clarity, novelty, feasibility, audience_fit, market_fit,
 *     differentiation, emotional_impact, sustainability)
 *
 * Все scores вычисляются детерминированно из входных данных.
 */

export interface AestheticProfileInput {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface MechanicSetInput {
  total_count: number;
  compatibility_score: number;
  cross_genre_mechanics?: Array<unknown>;
  genres_searched?: string[];
}

export interface USPCandidateInput {
  triangle_of_weirdness_check: string;
  usp: string;
}

export interface ValidationReport {
  triangle_check: {
    passed: boolean;
    score: number;
    details: string;
    weird: boolean;
    appealing: boolean;
    credible: boolean;
  };
  five_questions: Record<string, boolean>;
  eight_filters: Record<string, { score: number; reason: string; improvement: string }>;
  overall_score: number;
  warnings: string[];
  suggestions: string[];
}

/**
 * Построить validation report на основе концепции.
 *
 * @param aestheticProfile — primary/secondary/tertiary aesthetics
 * @param mechanicSet — набор механик (total_count, compatibility_score, cross_genre)
 * @param uspCandidates — кандидаты USP (нужно только triangle_of_weirdness_check)
 * @param idea — текст идеи (для анализа keywords, длины, verb-noun structure)
 * @param subgenres — массив subgenres (для multi-genre и cross-genre detection)
 */
export function buildValidationReport(
  aestheticProfile: AestheticProfileInput,
  mechanicSet: MechanicSetInput,
  uspCandidates: USPCandidateInput[],
  idea: string,
  subgenres: string[]
): ValidationReport {
  // --- Анализ идеи для filters и questions ---
  const ideaLower = idea.toLowerCase();
  const wordCount = idea.split(/\s+/).filter((w) => w.length > 0).length;
  const sentenceCount = (idea.match(/[.!?]+/g) || []).length || 1;
  void sentenceCount; // зарезервировано для будущих эвристик

  // Verb-noun structure detection: ищем глагол (action) + существительное (object).
  const actionVerbs = [
    "build", "survive", "explore", "fight", "collect", "escape", "defend", "conquer",
    "solve", "race", "craft", "trade", "hunt", "protect", "destroy", "create",
    "строить", "выживать", "исследовать", "сражаться", "собирать", "бежать", "защищать", "завоёвывать",
    "решать", "гнать", "крафтить", "торговать", "охотиться", "уничтожать", "создавать",
  ];
  const hasActionVerb = actionVerbs.some((v) =>
    new RegExp(`\\b${v}`, "i").test(ideaLower)
  );

  // Novelty indicators.
  const noveltyIndicators = [
    /\b(never before|unique|novel|innovative|original|unprecedented)\b/i,
    /\b(никогда|уникальн|новаторск|оригинальн|беспрецедентн)\b/i,
  ];
  const hasNoveltyKeyword = noveltyIndicators.some((r) => r.test(idea));
  const hasMultiGenre = subgenres.length >= 2;
  const hasCrossGenre = (mechanicSet.cross_genre_mechanics?.length || 0) > 0;

  // Emotional keywords.
  const emotionalKeywords = [
    /\b(fear|love|hope|despair|joy|anger|sadness|wonder|awe|terror|triumph)\b/i,
    /\b(страх|любовь|надежд|отчаян|радость|гнев|печаль|восторг|ужас|победа)\b/i,
  ];
  const hasEmotionalKeyword = emotionalKeywords.some((r) => r.test(idea));

  // Sustainability indicators.
  const sustainabilityKeywords = [
    /\b(replay|procedural|roguelike|multiplayer|endless|meta|live-ops|seasonal)\b/i,
    /\b(повтор|процедурн|рогалик|мультиплеер|бесконечн|мета|сезон)\b/i,
  ];
  const hasSustainabilityKeyword = sustainabilityKeywords.some((r) => r.test(idea));

  // --- Triangle of Weirdness ---
  const weird = uspCandidates.some((c) => c.triangle_of_weirdness_check === "pass");
  const appealing = aestheticProfile.primary !== "submission";
  const credible = mechanicSet.compatibility_score >= 60;
  const triangleScore = Number(
    ((weird ? 0.4 : 0.2) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)).toFixed(2)
  );
  const trianglePassed = triangleScore >= 0.6;

  // --- 5 core questions ---
  const hasCoreVerb = hasActionVerb;
  const hasMomentToMomentDetail = wordCount >= 15 && hasActionVerb;
  const hasLongTermGoal = mechanicSet.total_count >= 5;
  const hasFunSource = appealing;
  const hasReturnReason = credible && (hasSustainabilityKeyword || hasCrossGenre);

  const fiveQuestions: Record<string, boolean> = {
    "What is the core verb?": hasCoreVerb,
    "What does the player do moment-to-moment?": hasMomentToMomentDetail,
    "What long-term goal drives the player?": hasLongTermGoal,
    "Where does the fun come from?": hasFunSource,
    "Why would a player return tomorrow?": hasReturnReason,
  };

  // --- 8 idea filters ---

  // 1. Clarity
  let clarityScore: number;
  if (wordCount < 5) {
    clarityScore = 0.3;
  } else if (wordCount <= 30) {
    clarityScore = hasActionVerb ? 0.9 : 0.6;
  } else if (wordCount <= 60) {
    clarityScore = 0.6;
  } else {
    clarityScore = 0.4;
  }

  // 2. Novelty
  let noveltyScore = 0.5;
  if (hasNoveltyKeyword) noveltyScore += 0.2;
  if (hasMultiGenre) noveltyScore += 0.15;
  if (hasCrossGenre) noveltyScore += 0.15;
  if (weird) noveltyScore = Math.max(noveltyScore, 0.85);
  noveltyScore = Math.min(1.0, noveltyScore);

  // 3. Feasibility
  let feasibilityScore: number;
  if (mechanicSet.compatibility_score >= 80 && mechanicSet.total_count >= 8) {
    feasibilityScore = 0.9;
  } else if (mechanicSet.compatibility_score >= 60 && mechanicSet.total_count >= 5) {
    feasibilityScore = 0.75;
  } else if (mechanicSet.compatibility_score >= 40) {
    feasibilityScore = 0.55;
  } else {
    feasibilityScore = 0.4;
  }

  // 4. Audience fit
  const audienceFitByAesthetic: Record<string, number> = {
    challenge: 0.9,
    fantasy: 0.85,
    sensation: 0.8,
    discovery: 0.75,
    fellowship: 0.7,
    expression: 0.65,
    narrative: 0.6,
    submission: 0.4,
  };
  const audienceFitScore = audienceFitByAesthetic[aestheticProfile.primary] ?? 0.5;

  // 5. Market fit
  // TASK-1.3 FIXED: market_fit теперь вычисляется по primary genre (из genres_searched),
  // а не по aesthetic (который раньше ошибочно использовался как genre lookup).
  const marketFitByGenre: Record<string, number> = {
    rpg: 0.85, shooter: 0.85, strategy: 0.8, mmorpg: 0.75,
    action: 0.8, adventure: 0.75, puzzle: 0.7, platformer: 0.7,
    roguelike: 0.65, horror: 0.65, sandbox: 0.65,
    racing: 0.6, fighting: 0.6, tower_defense: 0.55,
    rhythm: 0.5, metroidvania: 0.5, visual_novel: 0.45,
    idle: 0.55, stealth: 0.5, survival_horror: 0.6,
    action_rpg: 0.82, jrpg: 0.78, tactical_rpg: 0.7,
    rts: 0.72, tbs: 0.68, simulation: 0.62,
    party: 0.55, educational: 0.5, sports: 0.65,
  };
  // TASK-1.3: используем primary genre из genres_searched (первый элемент = primary).
  const primaryGenreFromSearch = mechanicSet.genres_searched?.[0] || "action";
  const marketFitScore = marketFitByGenre[primaryGenreFromSearch] ?? 0.6;
  const marketFitFinal = Math.min(0.95, marketFitScore + (hasMultiGenre ? 0.1 : 0));

  // 6. Differentiation
  let differentiationScore = 0.4;
  if (weird) differentiationScore += 0.25;
  if (hasMultiGenre) differentiationScore += 0.15;
  if (hasCrossGenre) differentiationScore += 0.15;
  differentiationScore = Math.min(0.95, differentiationScore);

  // 7. Emotional impact
  let emotionalImpactScore = 0.5;
  if (hasEmotionalKeyword) emotionalImpactScore += 0.2;
  if (["narrative", "fantasy", "submission", "fellowship"].includes(aestheticProfile.primary)) {
    emotionalImpactScore += 0.15;
  }
  if (["challenge", "sensation"].includes(aestheticProfile.primary)) {
    emotionalImpactScore += 0.1;
  }
  emotionalImpactScore = Math.min(0.9, emotionalImpactScore);

  // 8. Sustainability
  let sustainabilityScore = 0.45;
  if (hasSustainabilityKeyword) sustainabilityScore += 0.25;
  if (hasCrossGenre) sustainabilityScore += 0.15;
  if (mechanicSet.total_count >= 10) sustainabilityScore += 0.1;
  sustainabilityScore = Math.min(0.9, sustainabilityScore);

  const eightFilters: Record<string, { score: number; reason: string; improvement: string }> = {
    clarity: {
      score: Number(clarityScore.toFixed(2)),
      reason: wordCount < 5
        ? "Идея слишком короткая — недостаточно деталей"
        : wordCount > 60
        ? "Идея слишком длинная — сожмите до 30 слов"
        : hasActionVerb
        ? "Чёткая verb-noun структура, идея выражается в одном предложении"
        : "Нет явного глагола действия — добавьте core verb",
      improvement: wordCount < 5
        ? "Добавьте конкретики: что игрок делает, с чем взаимодействует"
        : wordCount > 60
        ? "Сожмите идею до 30 слов, выделив главное"
        : "Сформулируйте идею в форме «глагол + существительное»: «Build a castle», «Survive the night»",
    },
    novelty: {
      score: Number(noveltyScore.toFixed(2)),
      reason: hasNoveltyKeyword
        ? "Найдены явные индикаторы новизны"
        : hasMultiGenre
        ? "Новизна через мульти-жанровость"
        : hasCrossGenre
        ? "Cross-genre механики добавляют новизны"
        : weird
        ? "USP проходит Triangle of Weirdness"
        : "Знакомые жанровые конвенции доминируют",
      improvement: "Добавьте один по-настоящему странный угол (Triangle of Weirdness) или необычное сочетание жанров",
    },
    feasibility: {
      score: Number(feasibilityScore.toFixed(2)),
      reason: feasibilityScore >= 0.75
        ? "Набор механик реализуем в заданном scope"
        : feasibilityScore >= 0.55
        ? "Реализуем, но требует тщательного планирования"
        : "Низкая совместимость механик или слишком амбициозный scope",
      improvement: feasibilityScore < 0.6
        ? "Сократите scope или добавьте чёткий MVP slice"
        : "Определите MVP — минимальный играбельный slice",
    },
    audience_fit: {
      score: Number(audienceFitScore.toFixed(2)),
      reason: audienceFitScore >= 0.75
        ? "Эстетика соответствует широкой аудитории"
        : audienceFitScore >= 0.55
        ? "Эстетика соответствует средней аудитории"
        : "Узкая нишевая эстетика — ограниченная аудитория",
      improvement: audienceFitScore < 0.6
        ? "Пересмотрите primary aesthetic для более широкой аудитории"
        : "Подтвердите target audience через reference games",
    },
    market_fit: {
      score: Number(marketFitFinal.toFixed(2)),
      reason: hasMultiGenre
        ? "Мульти-жанровость расширяет потенциальный рынок"
        : marketFitFinal >= 0.75
        ? "Жанр имеет устоявшуюся аудиторию"
        : "Нишевый жанр с ограниченным рынком",
      improvement: "Идентифицируйте 2-3 прямых конкурента и сформулируйте одну конкретную дифференциацию",
    },
    differentiation: {
      score: Number(differentiationScore.toFixed(2)),
      reason: differentiationScore >= 0.7
        ? "USP + мульти-жанровость + cross-genre = сильная дифференциация"
        : differentiationScore >= 0.5
        ? "Есть элементы дифференциации, но нужны более сильные"
        : "USP кандидаты требуют более странного угла",
      improvement: "Усильте Triangle of Weirdness — добавьте один по-настоящему уникальный элемент",
    },
    emotional_impact: {
      score: Number(emotionalImpactScore.toFixed(2)),
      reason: hasEmotionalKeyword
        ? "Найдены эмоциональные keywords в идее"
        : emotionalImpactScore >= 0.65
        ? "Эстетика обещает эмоциональное путешествие"
        : "Недостаточно эмоциональных якорей",
      improvement: "Свяжите aesthetic с конкретными эмоциональными моментами в player journey",
    },
    sustainability: {
      score: Number(sustainabilityScore.toFixed(2)),
      reason: hasSustainabilityKeyword
        ? "Найдены индикаторы replayability/meta"
        : hasCrossGenre
        ? "Cross-genre механики добавляют variety"
        : sustainabilityScore >= 0.6
        ? "Core loop имеет потенциал к повторному прохождению"
        : "Недостаточно hook'ов для возврата игрока",
      improvement: "Добавьте meta-loop или live-ops hook (сезоны, daily challenges, leaderboard)",
    },
  };

  const overallScore = Number(
    (
      triangleScore * 0.3 +
      (Object.values(fiveQuestions).filter(Boolean).length / 5) * 0.3 +
      (Object.values(eightFilters).reduce((s, f) => s + f.score, 0) /
        Object.keys(eightFilters).length) *
        0.4
    ).toFixed(3)
  );

  const warnings: string[] = [];
  if (!credible) warnings.push("Совместимость механик ниже 60% — проверьте синергии");
  if (!appealing) warnings.push("Primary aesthetic = 'submission' — может не привлечь широкую аудиторию");
  if (!weird) warnings.push("Ни один USP не прошёл Triangle of Weirdness — усильте уникальность");
  if (!hasCoreVerb) warnings.push("В идее нет явного глагола действия — добавьте core verb");
  if (wordCount > 60) warnings.push("Идея слишком длинная — сожмите до 30 слов");

  const suggestions: string[] = [
    "Запустите 5-минутный бумажный прототип для проверки core verb",
    "Определите 3 прямых конкурента и сформулируйте одну конкретную дифференциацию",
    "Свяжите aesthetic profile с конкретными моментами в player journey",
  ];
  if (hasMultiGenre) {
    suggestions.push(`Мульти-жанровость (${subgenres.join(", ")}) — проверьте, что жанры действительно дополняют друг друга`);
  }
  if (hasCrossGenre) {
    suggestions.push("Cross-genre механики добавлены — протестируйте их в MVP slice");
  }

  return {
    triangle_check: {
      passed: trianglePassed,
      score: triangleScore,
      details: `Weird=${weird}, Appealing=${appealing}, Credible=${credible}`,
      weird,
      appealing,
      credible,
    },
    five_questions: fiveQuestions,
    eight_filters: eightFilters,
    overall_score: overallScore,
    warnings,
    suggestions,
  };
}
