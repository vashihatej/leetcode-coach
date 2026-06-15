import "./content-runtime.js";

export const {
  parseSlug,
  parseTitle,
  parseDifficulty,
  parseDescription,
  parseTopicTags,
  parseExamples,
  parseConstraints,
  buildProblemPayload,
} = globalThis.LeetCodeCoachContentRuntime;
