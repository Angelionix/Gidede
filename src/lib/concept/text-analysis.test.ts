import { describe, expect, it } from "vitest";
import {
  hasCoreActionVerb,
  inferGenresFromText,
  rankAestheticsFromText,
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
