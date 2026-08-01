import { describe, expect, it } from "vitest";
import {
  classifyGenresFromText,
  hasCoreActionVerb,
  inferGenresFromText,
  rankAestheticsFromText,
  resolveGenreClassification,
} from "./text-analysis";

describe("Concept RU/EN text analysis", () => {
  it("recognizes Russian genre words and phrases", () => {
    expect(inferGenresFromText("Пошаговая стратегия о караванах и тактике").primary)
      .toBe("strategy");
    expect(inferGenresFromText("Визуальная новелла о ночной радиоведущей").primary)
      .toBe("visual_novel");
    expect(inferGenresFromText("Кооперативная защита башен от волн").primary)
      .toBe("tower_defense");
  });

  it("returns exact matched-keyword evidence in deterministic score order", () => {
    const result = classifyGenresFromText(
      "A sandbox game to craft and build in an open world with a card deck and roguelike runs"
    );

    expect(result).toMatchObject({
      classifier_version: "1.0.0",
      selection_source: "keyword_match",
      selected_primary: "sandbox",
      selected_subgenres: ["roguelike", "strategy"],
    });
    expect(result.candidates).toEqual([
      {
        genre: "sandbox",
        score: 4,
        matched_keywords: ["sandbox", "craft", "build", "open world"],
      },
      {
        genre: "roguelike",
        score: 3,
        matched_keywords: ["card", "deck", "roguelike"],
      },
      { genre: "strategy", score: 1, matched_keywords: ["build"] },
    ]);
  });

  it("does not classify substrings as genre evidence", () => {
    const result = classifyGenresFromText(
      "A history of a steam-powered gunship carrying carpet while someone rebuilds cities"
    );

    expect(result).toEqual({
      classifier_version: "1.0.0",
      selection_source: "fallback_default",
      selected_primary: "action",
      selected_subgenres: [],
      candidates: [],
      fallback_reason: "no_keyword_matches",
    });
  });

  it("marks explicit selection and retains inferred candidates as evidence", () => {
    const result = resolveGenreClassification(
      "A shooter with quests and character leveling",
      { primaryGenre: "puzzle" }
    );

    expect(result.selection_source).toBe("explicit");
    expect(result.selected_primary).toBe("puzzle");
    expect(result.selected_subgenres).toEqual(["rpg", "shooter"]);
    expect(result.candidates.map(({ genre }) => genre)).toEqual(["rpg", "shooter"]);
    expect(result.fallback_reason).toBeUndefined();
  });

  it("deduplicates explicit subgenres and excludes the selected primary", () => {
    const result = resolveGenreClassification("No genre signals here", {
      primaryGenre: "strategy",
      subgenres: ["strategy", "puzzle", "puzzle", "rpg", "idle", "horror"],
    });

    expect(result.selected_subgenres).toEqual(["puzzle", "rpg", "idle"]);
  });

  it("recognizes Russian and English aesthetic vocabulary", () => {
    expect(rankAestheticsFromText("Команда друзей играет вместе в гильдии")[0])
      .toBe("fellowship");
    expect(rankAestheticsFromText("Explore and discover a hidden world")[0])
      .toBe("discovery");
  });

  it("recognizes inflected Russian core verbs", () => {
    expect(hasCoreActionVerb("Игрок исследует руины и собирает артефакты")).toBe(true);
    expect(hasCoreActionVerb("Игрок планирует маршрут и защищает караван")).toBe(true);
    expect(hasCoreActionVerb("Красивый мир, полный загадок")).toBe(false);
  });
});
