export function buildEvent({ problem, url, code, language, lastResult }) {
  return {
    slug: problem.slug,
    title: problem.title ?? null,
    difficulty: problem.difficulty ?? null,
    url,
    code: code ?? null,
    language: language ?? null,
    lastResult: lastResult ?? null,
  };
}

export async function postEvent(fetchFn, url, payload) {
  try {
    await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}
