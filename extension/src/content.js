// ISOLATED world: scrapes static DOM, merges bridge messages, POSTs to the local coach.
(function () {
  const SERVER = "http://localhost:8765/event";
  const SOURCE = "coach-bridge";

  let latestCode = null;
  let latestLanguage = null;
  let latestResult = null;

  function parseSlug(pathname) {
    const m = /\/problems\/([^/]+)/.exec(pathname || "");
    return m ? m[1] : null;
  }
  function parseTitle(t) {
    if (!t) return null;
    return t.replace(/\s*-\s*LeetCode.*$/i, "").trim() || null;
  }
  function parseDifficulty() {
    const el = document.querySelector('[class*="text-difficulty-"]');
    if (!el) return null;
    const m = /text-difficulty-(easy|medium|hard)/.exec(el.className);
    return m ? m[1][0].toUpperCase() + m[1].slice(1) : null;
  }
  function parseDescription() {
    const el = document.querySelector('[data-track-load="description_content"]');
    return el ? el.textContent.trim() : null;
  }

  function buildEvent() {
    return {
      slug: parseSlug(location.pathname),
      title: parseTitle(document.title),
      difficulty: parseDifficulty(),
      url: location.href,
      code: latestCode,
      language: latestLanguage,
      lastResult: latestResult,
    };
  }

  async function send() {
    const event = buildEvent();
    if (!event.slug) return;
    try {
      await fetch(SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {}
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(); }, ms);
    };
  }
  const debouncedSend = debounce(send, 800);

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== SOURCE) return;
    if (d.type === "coach:code") {
      latestCode = d.payload.code;
      latestLanguage = d.payload.language;
      debouncedSend();
    } else if (d.type === "coach:result") {
      latestResult = d.payload;
      send(); // results are important — send immediately
    }
  });

  // Initial problem push so session.md reflects the page even before typing.
  send();
})();
