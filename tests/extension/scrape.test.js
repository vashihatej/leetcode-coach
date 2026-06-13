// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  parseSlug,
  parseTitle,
  parseDifficulty,
  parseDescription,
  buildProblemPayload,
} from "../../extension/src/scrape.js";

describe("parseSlug", () => {
  it("extracts the slug from a problem pathname", () => {
    expect(parseSlug("/problems/two-sum/")).toBe("two-sum");
    expect(parseSlug("/problems/two-sum/description/")).toBe("two-sum");
  });
  it("returns null when there is no problem segment", () => {
    expect(parseSlug("/contest/")).toBe(null);
    expect(parseSlug("")).toBe(null);
  });
});

describe("parseTitle", () => {
  it("strips the LeetCode suffix", () => {
    expect(parseTitle("Two Sum - LeetCode")).toBe("Two Sum");
  });
  it("returns null for empty input", () => {
    expect(parseTitle("")).toBe(null);
  });
});

describe("parseDifficulty", () => {
  it("reads difficulty from a text-difficulty-* class", () => {
    document.body.innerHTML =
      '<div class="rounded-full bg-fill-secondary text-difficulty-medium">Medium</div>';
    expect(parseDifficulty(document)).toBe("Medium");
  });
  it("returns null when absent", () => {
    document.body.innerHTML = "<div>nothing</div>";
    expect(parseDifficulty(document)).toBe(null);
  });
});

describe("parseDescription", () => {
  it("reads the description_content block text", () => {
    document.body.innerHTML =
      '<div data-track-load="description_content"><p>Given an array...</p></div>';
    expect(parseDescription(document)).toBe("Given an array...");
  });
});

describe("buildProblemPayload", () => {
  it("assembles slug/title/difficulty/description", () => {
    document.body.innerHTML =
      '<div class="text-difficulty-easy">Easy</div>' +
      '<div data-track-load="description_content">Desc here</div>';
    const payload = buildProblemPayload({
      pathname: "/problems/two-sum/",
      documentTitle: "Two Sum - LeetCode",
      doc: document,
    });
    expect(payload).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      description: "Desc here",
    });
  });
});
