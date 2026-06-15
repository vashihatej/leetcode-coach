// ISOLATED world: scrapes static DOM, merges bridge messages, POSTs to the local coach.
(function () {
  const SERVER = "http://localhost:8765/event";
  const SOURCE = "coach-bridge";
  const runtime = globalThis.LeetCodeCoachContentRuntime;

  let latestCode = null;
  let latestLanguage = null;
  let latestResult = null;
  let currentSlug = runtime.parseSlug(location.pathname);

  function readProblem() {
    return runtime.buildProblemPayload({
      pathname: location.pathname,
      documentTitle: document.title,
      doc: document,
    });
  }

  function buildEvent() {
    return runtime.buildEvent({
      problem: readProblem(),
      url: location.href,
      code: latestCode,
      language: latestLanguage,
      lastResult: latestResult,
    });
  }

  async function send() {
    const event = buildEvent();
    if (!event.slug) return;
    await runtime.postEvent(fetch, SERVER, event);
  }

  const debouncedSend = runtime.debounce(send, 800);

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== SOURCE || !d.payload) return;
    if (d.type === "coach:code") {
      latestCode = d.payload.code;
      latestLanguage = d.payload.language;
      debouncedSend();
    } else if (d.type === "coach:result") {
      latestResult = d.payload;
      send(); // results are important — send immediately
    }
  });

  // LeetCode navigates between problems without reloading the content script.
  setInterval(() => {
    const slug = runtime.parseSlug(location.pathname);
    if (slug && slug !== currentSlug) {
      currentSlug = slug;
      latestCode = null;
      latestLanguage = null;
      latestResult = null;
      send();
    }
  }, 1000);

  // Initial problem push so session.md reflects the page even before typing.
  send();
})();
