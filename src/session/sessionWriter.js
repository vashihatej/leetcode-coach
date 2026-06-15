import fs from "node:fs";

export function writeSession(filePath, event) {
  const {
    title = "(unknown)",
    difficulty = "",
    topicTags = [],
    description,
    examples = [],
    constraints = [],
    url = "",
    language = "",
    code,
    lastResult,
  } = event;

  const tags = Array.isArray(topicTags) && topicTags.length ? topicTags.join(", ") : "—";
  const statementBlock = description || "_(problem statement unavailable)_";
  const examplesBlock = Array.isArray(examples) && examples.length
    ? examples.map((example, index) => `### Example ${index + 1}\n\n\`\`\`\n${example}\n\`\`\``).join("\n\n")
    : "_(examples unavailable)_";
  const constraintsBlock = Array.isArray(constraints) && constraints.length
    ? constraints.map((constraint) => `- ${constraint}`).join("\n")
    : "_(constraints unavailable)_";
  const codeBlock = code
    ? "```" + (language || "") + "\n" + code + "\n```"
    : "_(no code yet)_";

  let resultBlock = "_(no run/submit yet)_";
  if (lastResult) {
    const { statusMsg = "?", totalCorrect, totalTestcases, runtime, memory, error } =
      lastResult;
    const parts = [];
    if (totalCorrect != null && totalTestcases != null) {
      parts.push(`${totalCorrect}/${totalTestcases} testcases`);
    }
    if (runtime) parts.push(runtime);
    if (memory) parts.push(memory);
    const meta = parts.length ? ` — ${parts.join(" · ")}` : "";
    resultBlock = `**${statusMsg}**${meta}`;
    if (error) resultBlock += "\n\n```\n" + error + "\n```";
  }

  const md = `# ${title}

- **Difficulty:** ${difficulty || "—"}
- **Tags:** ${tags}
- **URL:** ${url || "—"}
- **Language:** ${language || "—"}
- **Updated:** ${new Date().toISOString()}

## Problem statement

${statementBlock}

## Examples

${examplesBlock}

## Constraints

${constraintsBlock}

## Current code

${codeBlock}

## Last result

${resultBlock}
`;

  fs.writeFileSync(filePath, md, "utf8");
}
