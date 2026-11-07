import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import path from "path";
import { categoryImages, getCategoryImage } from "./category-images";

describe("category images", () => {
  it.each(Object.entries(categoryImages))("%s points to an existing file", (_category, src) => {
    expect(existsSync(path.join(process.cwd(), "public", src))).toBe(true);
  });

  it("falls back to the default image for unknown categories", () => {
    expect(existsSync(path.join(process.cwd(), "public", getCategoryImage("Sconosciuta")))).toBe(true);
  });
});
