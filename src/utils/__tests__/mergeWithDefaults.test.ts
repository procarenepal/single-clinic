import { describe, it, expect } from "vitest";

import { mergeWithDefaults } from "../mergeWithDefaults";

const defaults = {
  hero: {
    title: "Default title",
    subtitle: "Default sub",
    slides: [{ img: "a.png", cap: "A" }],
  },
  stats: [
    { number: "5k+", label: "Clients", imageUrl: "/clients.png" },
    { number: "15+", label: "Years", imageUrl: "/years.png" },
  ],
  sections: { stats: true, team: true },
  note: "hi",
};

describe("mergeWithDefaults", () => {
  it("returns the defaults when nothing was saved", () => {
    expect(mergeWithDefaults(defaults, undefined)).toEqual(defaults);
    expect(mergeWithDefaults(defaults, null)).toEqual(defaults);
  });

  it("keeps saved values and fills fields that did not exist when it was saved", () => {
    const merged = mergeWithDefaults(defaults, { hero: { title: "My title" } });

    expect(merged.hero.title).toBe("My title");
    expect(merged.hero.subtitle).toBe("Default sub");
    expect(merged.hero.slides).toEqual(defaults.hero.slides);
  });

  it("lets a saved empty string stay empty (an admin clearing a field)", () => {
    expect(mergeWithDefaults(defaults, { note: "" }).note).toBe("");
  });

  it("tops up items of a saved array from the default at the same position", () => {
    const merged = mergeWithDefaults(defaults, {
      stats: [
        { number: "15k+", label: "Happy Clients" },
        { number: "15+", label: "Years", imageUrl: "/mine.png" },
      ],
    });

    expect(merged.stats[0]).toEqual({
      number: "15k+",
      label: "Happy Clients",
      imageUrl: "/clients.png",
    });
    expect(merged.stats[1].imageUrl).toBe("/mine.png");
  });

  it("keeps a saved array as saved: deleted items stay deleted, extra items are kept", () => {
    expect(
      mergeWithDefaults(defaults, { stats: [{ number: "1", label: "Only" }] })
        .stats,
    ).toHaveLength(1);
    expect(
      mergeWithDefaults(defaults, {
        stats: [...defaults.stats, { number: "3", label: "New", imageUrl: "" }],
      }).stats,
    ).toHaveLength(3);
  });

  it("allows an empty saved array", () => {
    expect(
      mergeWithDefaults(defaults, { hero: { slides: [] } }).hero.slides,
    ).toEqual([]);
  });

  it("keeps section switches, including turning one off", () => {
    expect(
      mergeWithDefaults(defaults, { sections: { team: false } }).sections,
    ).toEqual({
      stats: true,
      team: false,
    });
  });

  it("ignores a saved value of the wrong type", () => {
    expect(mergeWithDefaults(defaults, { note: 5 }).note).toBe("hi");
    expect(mergeWithDefaults(defaults, { hero: "oops" }).hero).toEqual(
      defaults.hero,
    );
    expect(mergeWithDefaults(defaults, { stats: "oops" }).stats).toEqual(
      defaults.stats,
    );
  });

  it("carries through saved keys the defaults do not know about", () => {
    expect((mergeWithDefaults(defaults, { extra: "x" }) as any).extra).toBe(
      "x",
    );
  });

  it("does not modify the defaults", () => {
    const copy = JSON.parse(JSON.stringify(defaults));

    mergeWithDefaults(defaults, { hero: { title: "x" }, stats: [] });
    expect(defaults).toEqual(copy);
  });
});
