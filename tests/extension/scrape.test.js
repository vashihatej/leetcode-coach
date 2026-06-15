// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  parseSlug,
  parseTitle,
  parseDifficulty,
  parseDescription,
  parseTopicTags,
  parseExamples,
  parseConstraints,
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

describe("problem context", () => {
  it("extracts examples, constraints, and unique topic tags", () => {
    document.body.innerHTML = `
      <a href="/tag/array/">Array</a>
      <a href="/tag/hash-table/">Hash Table</a>
      <a href="/tag/array/">Array</a>
      <div data-track-load="description_content">
        <p>Given an array...</p>
        <pre>Input: nums = [2,7], target = 9
Output: [0,1]</pre>
        <p><strong>Constraints:</strong></p>
        <ul><li>2 <= nums.length <= 10^4</li><li>-10^9 <= nums[i] <= 10^9</li></ul>
      </div>`;
    expect(parseTopicTags(document)).toEqual(["Array", "Hash Table"]);
    expect(parseExamples(document)).toEqual([
      "Input: nums = [2,7], target = 9\nOutput: [0,1]",
    ]);
    expect(parseConstraints(document)).toEqual([
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
    ]);
  });
});

describe("buildProblemPayload", () => {
  it("assembles the complete problem context", () => {
    document.body.innerHTML =
      '<div class="text-difficulty-easy">Easy</div>' +
      '<a href="/tag/array/">Array</a>' +
      '<div data-track-load="description_content">Desc here<pre>Example here</pre></div>';
    const payload = buildProblemPayload({
      pathname: "/problems/two-sum/",
      documentTitle: "Two Sum - LeetCode",
      doc: document,
    });
    expect(payload).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      description: "Desc hereExample here",
      examples: ["Example here"],
      constraints: [],
      topicTags: ["Array"],
    });
  });
});
