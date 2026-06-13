import fs from "node:fs";

export function writeSession(filePath, event) {
  const {
    title = "(unknown)",
    difficulty = "",
    topicTags = [],
    url = "",
    language = "",
    code,
    lastResult,
  } = event;

  const tags = topicTags.length ? topicTags.join(", ") : "—";
  const codeBlock = code
    ? "```" + (language || "") + "\n" + code + "\n```"
    : "_(no code yet)_";

  let resultBlock = "_(no run/submit yet)_";
  if (lastResult) {
    const { type = "?", status = "?", details = "" } = lastResult;
    resultBlock = `**${type}** → ${status}${details ? `\n\n${details}` : ""}`;
  }

  const md = `# ${title}

- **Difficulty:** ${difficulty || "—"}
- **Tags:** ${tags}
- **URL:** ${url || "—"}
- **Language:** ${language || "—"}
- **Updated:** ${new Date().toISOString()}

## Current code

${codeBlock}

## Last result

${resultBlock}
`;

  fs.writeFileSync(filePath, md, "utf8");
}
