import { describe, expect, it } from "@rstest/core";
import { letterToIndex, indexToLetter } from "../src/preprocessing.js";

describe("preprocessing", () => {
  describe("letterToIndex", () => {
    it("should convert lowercase letters to indices", () => {
      expect(letterToIndex("a")).toBe(0);
      expect(letterToIndex("b")).toBe(1);
      expect(letterToIndex("z")).toBe(25);
    });

    it("should handle uppercase letters", () => {
      expect(letterToIndex("A")).toBe(0);
      expect(letterToIndex("Z")).toBe(25);
    });

    it("should throw on invalid input", () => {
      expect(() => letterToIndex("1")).toThrow();
      expect(() => letterToIndex("@")).toThrow();
    });
  });

  describe("indexToLetter", () => {
    it("should convert indices to letters", () => {
      expect(indexToLetter(0)).toBe("a");
      expect(indexToLetter(1)).toBe("b");
      expect(indexToLetter(25)).toBe("z");
    });

    it("should throw on invalid index", () => {
      expect(() => indexToLetter(-1)).toThrow();
      expect(() => indexToLetter(26)).toThrow();
    });
  });
});
