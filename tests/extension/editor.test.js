import { describe, it, expect } from "vitest";
import { readEditorCode } from "../../extension/src/editor.js";

function fakeModel(lang, value) {
  return { getLanguageId: () => lang, getValue: () => value };
}

describe("readEditorCode", () => {
  it("returns the first non-plaintext model's code and language", () => {
    const monaco = {
      editor: {
        getModels: () => [
          fakeModel("plaintext", ""),
          fakeModel("cpp", "class Solution {};"),
        ],
      },
    };
    expect(readEditorCode(monaco)).toEqual({
      code: "class Solution {};",
      language: "cpp",
    });
  });

  it("returns null when monaco is unavailable", () => {
    expect(readEditorCode(undefined)).toBe(null);
    expect(readEditorCode({})).toBe(null);
  });

  it("returns null when there are no models", () => {
    expect(readEditorCode({ editor: { getModels: () => [] } })).toBe(null);
  });
});
