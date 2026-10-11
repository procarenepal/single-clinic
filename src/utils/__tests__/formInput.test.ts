import { describe, it, expect } from "vitest";

import {
  capitalizeWords,
  caretAfterTransform,
  formatBsDateInput,
} from "../formInput";

describe("capitalizeWords", () => {
  it("upper-cases the first letter of every word", () => {
    expect(capitalizeWords("namita giri")).toBe("Namita Giri");
    expect(capitalizeWords("ward no 5, new baneshwor")).toBe(
      "Ward No 5, New Baneshwor",
    );
  });

  it("capitalizes the first letter as soon as it is typed", () => {
    expect(capitalizeWords("n")).toBe("N");
    expect(capitalizeWords("Namita g")).toBe("Namita G");
  });

  it("keeps trailing and repeated spaces so typing is not disturbed", () => {
    expect(capitalizeWords("namita ")).toBe("Namita ");
    expect(capitalizeWords("namita  giri")).toBe("Namita  Giri");
    expect(capitalizeWords(" namita")).toBe(" Namita");
  });

  it("capitalizes after a hyphen", () => {
    expect(capitalizeWords("mary-jane")).toBe("Mary-Jane");
  });

  it("leaves the rest of each word as typed", () => {
    expect(capitalizeWords("PO box 12")).toBe("PO Box 12");
    expect(capitalizeWords("mcDonald")).toBe("McDonald");
    expect(capitalizeWords("NAMITA GIRI")).toBe("NAMITA GIRI");
  });

  it("does not change digits, empty input or scripts without case", () => {
    expect(capitalizeWords("")).toBe("");
    expect(capitalizeWords("5 hetauda-10")).toBe("5 Hetauda-10");
    expect(capitalizeWords("नमिता गिरी")).toBe("नमिता गिरी");
  });

  it("is idempotent", () => {
    const once = capitalizeWords("namita giri, hetauda-5");

    expect(capitalizeWords(once)).toBe(once);
  });
});

describe("formatBsDateInput", () => {
  it("formats eight digits as YYYY/MM/DD", () => {
    expect(formatBsDateInput("20020314")).toBe("2002/03/14");
  });

  it("formats progressively while digits are typed one at a time", () => {
    const typed = [..."20020314"].reduce<string[]>((steps, digit) => {
      steps.push(formatBsDateInput((steps.at(-1) ?? "") + digit));

      return steps;
    }, []);

    expect(typed).toEqual([
      "2",
      "20",
      "200",
      "2002",
      "2002/0",
      "2002/03",
      "2002/03/1",
      "2002/03/14",
    ]);
  });

  it("ignores digits beyond the eight a date holds", () => {
    expect(formatBsDateInput("200203145")).toBe("2002/03/14");
  });

  it("zero-pads a one-digit month or day closed by a typed separator", () => {
    expect(formatBsDateInput("2080/6/")).toBe("2080/06/");
    expect(formatBsDateInput("2080/6/5")).toBe("2080/06/5");
  });

  it("normalizes pasted dates that use other separators", () => {
    expect(formatBsDateInput("2002-03-14")).toBe("2002/03/14");
    expect(formatBsDateInput("2002.03.14")).toBe("2002/03/14");
    expect(formatBsDateInput("2002 03 14")).toBe("2002/03/14");
    expect(formatBsDateInput("2002/03/14")).toBe("2002/03/14");
  });

  it("lets the user backspace through the separators", () => {
    expect(formatBsDateInput("2002/03/")).toBe("2002/03/");
    expect(formatBsDateInput("2002/03")).toBe("2002/03");
    expect(formatBsDateInput("2002/")).toBe("2002/");
    expect(formatBsDateInput("2002")).toBe("2002");
  });

  it("drops anything that is not a digit or a separator", () => {
    expect(formatBsDateInput("20a02")).toBe("2002");
    expect(formatBsDateInput("")).toBe("");
  });

  it("does not close the year early or stack separators", () => {
    expect(formatBsDateInput("20/")).toBe("20");
    expect(formatBsDateInput("/")).toBe("");
    expect(formatBsDateInput("2002//")).toBe("2002/");
    expect(formatBsDateInput("2002/03/14/")).toBe("2002/03/14");
  });

  it("is idempotent", () => {
    for (const raw of ["20020314", "2080/6/5", "2002-03-14", "2002/0"]) {
      const once = formatBsDateInput(raw);

      expect(formatBsDateInput(once)).toBe(once);
    }
  });
});

describe("caretAfterTransform", () => {
  it("keeps the caret at the end when typing at the end", () => {
    expect(caretAfterTransform("20020", "2002/0", 5)).toBe(6);
    expect(caretAfterTransform("namita g", "Namita G", 8)).toBe(8);
  });

  it("keeps the caret after the same letters when editing mid-text", () => {
    // "Namita |giri" + "x" -> caret sits right after the typed letter
    expect(caretAfterTransform("Namita xgiri", "Namita Xgiri", 8)).toBe(8);
    // "20020|3" typed in the middle of a formatted date
    expect(caretAfterTransform("2002/093/14", "2002/09/31", 7)).toBe(7);
  });
});
