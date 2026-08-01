import { describe, expect, it } from "vitest";
import { resolveCoreLoopInput } from "./input";

const CONCEPT = {
  id: "concept-1",
  genre: "puzzle",
  primaryAesthetic: "discovery",
  aestheticProfile: JSON.stringify({ primary: "discovery", secondary: "challenge" }),
  mechanicSet: JSON.stringify({
    base: [{ name: "Rotate Rooms" }],
    combat: [],
    progression: [{ name: "Unlock Light Paths" }],
    spatial: [{ name: "Redirect Light" }],
    social: [{ name: "Synchronize Robots" }],
  }),
};

describe("Core Loop input resolution", () => {
  it("uses selected Concept mechanics, genre and aesthetic when request overrides are absent", () => {
    expect(resolveCoreLoopInput({ project_id: "project-1" }, "rpg", CONCEPT)).toEqual({
      conceptId: "concept-1",
      mechanics: ["Rotate Rooms", "Unlock Light Paths", "Redirect Light", "Synchronize Robots"],
      genre: "puzzle",
      primaryAesthetic: "discovery",
      mechanicsSource: "concept",
    });
  });

  it("preserves explicit user overrides", () => {
    expect(resolveCoreLoopInput({
      concept_id: "custom-concept",
      mechanics: ["Fold Time", "Fold Time", "Echo Move"],
      genre: "strategy",
      primary_aesthetic: "challenge",
    }, "rpg", CONCEPT)).toEqual({
      conceptId: "custom-concept",
      mechanics: ["Fold Time", "Echo Move"],
      genre: "strategy",
      primaryAesthetic: "challenge",
      mechanicsSource: "request",
    });
  });

  it("reports missing mechanics instead of inventing explore/combat/reward", () => {
    const resolved = resolveCoreLoopInput({}, null, null);
    expect(resolved.mechanics).toEqual([]);
    expect(resolved.mechanicsSource).toBe("missing");
  });
});
