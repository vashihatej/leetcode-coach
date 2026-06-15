(function (root) {
  function parseSlug(pathname) {
    const match = /\/problems\/([^/]+)/.exec(pathname || "");
    return match ? match[1] : null;
  }

  function parseTitle(documentTitle) {
    if (!documentTitle) return null;
    const cleaned = documentTitle.replace(/\s*-\s*LeetCode.*$/i, "").trim();
    return cleaned || null;
  }

  function parseDifficulty(doc) {
    const element = doc.querySelector('[class*="text-difficulty-"]');
    if (!element) return null;
    const match = /text-difficulty-(easy|medium|hard)/.exec(element.className);
    if (!match) return null;
    return match[1][0].toUpperCase() + match[1].slice(1);
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function descriptionRoot(doc) {
    return doc.querySelector('[data-track-load="description_content"]');
  }

  function parseDescription(doc) {
    const element = descriptionRoot(doc);
    return element ? normalizeText(element.innerText || element.textContent) : null;
  }

  function parseTopicTags(doc) {
    const tags = Array.from(doc.querySelectorAll('a[href*="/tag/"]'))
      .map((element) => normalizeText(element.textContent))
      .filter(Boolean);
    return [...new Set(tags)];
  }

  function parseExamples(doc) {
    const rootElement = descriptionRoot(doc);
    if (!rootElement) return [];
    const examples = Array.from(rootElement.querySelectorAll("pre"))
      .map((element) => normalizeText(element.innerText || element.textContent))
      .filter(Boolean);
    return [...new Set(examples)];
  }

  function parseConstraints(doc) {
    const rootElement = descriptionRoot(doc);
    if (!rootElement) return [];

    const headings = Array.from(rootElement.querySelectorAll("strong, b, h3, h4"));
    const heading = headings.find((element) =>
      /^constraints?\s*:?\s*$/i.test(normalizeText(element.textContent))
    );
    if (heading) {
      const container = heading.closest("p, div") || heading;
      const next = container.nextElementSibling;
      if (next) {
        const items = Array.from(next.querySelectorAll("li"))
          .map((element) => normalizeText(element.innerText || element.textContent))
          .filter(Boolean);
        if (items.length) return items;
      }
    }

    const description = parseDescription(doc) || "";
    const match = /constraints?\s*:\s*([\s\S]*?)(?:follow[- ]?up\s*:|$)/i.exec(description);
    if (!match) return [];
    return match[1]
      .split(/\n+/)
      .map((line) => normalizeText(line).replace(/^[•*-]\s*/, ""))
      .filter(Boolean);
  }

  function buildProblemPayload({ pathname, documentTitle, doc }) {
    return {
      slug: parseSlug(pathname),
      title: parseTitle(documentTitle),
      difficulty: parseDifficulty(doc),
      description: parseDescription(doc),
      examples: parseExamples(doc),
      constraints: parseConstraints(doc),
      topicTags: parseTopicTags(doc),
    };
  }

  function buildEvent({ problem, url, code, language, lastResult }) {
    return {
      slug: problem.slug,
      title: problem.title ?? null,
      difficulty: problem.difficulty ?? null,
      description: problem.description ?? null,
      examples: problem.examples ?? [],
      constraints: problem.constraints ?? [],
      topicTags: problem.topicTags ?? [],
      url,
      code: code ?? null,
      language: language ?? null,
      lastResult: lastResult ?? null,
    };
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, args);
      }, ms);
    };
  }

  async function postEvent(fetchFn, url, payload) {
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response?.ok !== false;
    } catch {
      return false;
    }
  }

  root.LeetCodeCoachContentRuntime = Object.freeze({
    parseSlug,
    parseTitle,
    parseDifficulty,
    parseDescription,
    parseTopicTags,
    parseExamples,
    parseConstraints,
    buildProblemPayload,
    buildEvent,
    debounce,
    postEvent,
  });
})(globalThis);
