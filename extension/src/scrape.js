export function parseSlug(pathname) {
  const m = /\/problems\/([^/]+)/.exec(pathname || "");
  return m ? m[1] : null;
}

export function parseTitle(documentTitle) {
  if (!documentTitle) return null;
  const cleaned = documentTitle.replace(/\s*-\s*LeetCode.*$/i, "").trim();
  return cleaned || null;
}

export function parseDifficulty(doc) {
  const el = doc.querySelector('[class*="text-difficulty-"]');
  if (!el) return null;
  const m = /text-difficulty-(easy|medium|hard)/.exec(el.className);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1);
}

export function parseDescription(doc) {
  const el = doc.querySelector('[data-track-load="description_content"]');
  return el ? el.textContent.trim() : null;
}

export function buildProblemPayload({ pathname, documentTitle, doc }) {
  return {
    slug: parseSlug(pathname),
    title: parseTitle(documentTitle),
    difficulty: parseDifficulty(doc),
    description: parseDescription(doc),
  };
}
