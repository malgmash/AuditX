import { describe, expect, it } from "vitest";
import { fixtureCopy } from "./data";

const FORBIDDEN = /\b(fraud|theft|stealing|dishonest|guilty)\b/i;

describe("employee fixture reasons", () => {
  it("contains no forbidden words", () => {
    const hits = fixtureCopy().filter((text) => FORBIDDEN.test(text));
    expect(hits).toEqual([]);
  });
});
