// MAIN world: has access to window.monaco and the page's fetch/XHR.
// Forwards { type: "coach:code" } and { type: "coach:result" } to the isolated content script.
(function () {
  const SOURCE = "coach-bridge";

  function readEditorCode() {
    const monaco = window.monaco;
    if (!monaco || !monaco.editor) return null;
    const models = monaco.editor.getModels();
    if (!models || models.length === 0) return null;
    const m = models.find((x) => x.getLanguageId() !== "plaintext") || models[0];
    if (!m) return null;
    return { code: m.getValue(), language: m.getLanguageId() };
  }

  function postCode() {
    const c = readEditorCode();
    if (c) window.postMessage({ source: SOURCE, type: "coach:code", payload: c }, "*");
  }

  function shouldCaptureUrl(url) {
    return /\/submissions\/detail\/\d+\/check\/?/.test(url || "");
  }

  function parseVerdict(json) {
    if (!json || json.state !== "SUCCESS") return null;
    return {
      statusMsg: json.status_msg ?? null,
      totalCorrect: json.total_correct ?? null,
      totalTestcases: json.total_testcases ?? null,
      runtime: json.status_runtime ?? null,
      memory: json.status_memory ?? null,
      error:
        json.compile_error || json.full_compile_error ||
        json.runtime_error || json.full_runtime_error || null,
    };
  }

  function emitVerdict(json) {
    const v = parseVerdict(json);
    if (v) window.postMessage({ source: SOURCE, type: "coach:result", payload: v }, "*");
  }

  // Patch fetch to observe /check/ responses without altering them.
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (shouldCaptureUrl(url)) {
        res.clone().json().then(emitVerdict).catch(() => {});
      }
    } catch {}
    return res;
  };

  // Patch XHR for the same endpoint (LeetCode polls via XHR in some flows).
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__coachUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (shouldCaptureUrl(this.__coachUrl)) emitVerdict(JSON.parse(this.responseText));
      } catch {}
    });
    return origSend.apply(this, args);
  };

  // Poll the editor for code changes (Monaco has no global change event we can rely on here).
  setInterval(postCode, 1500);
  postCode();
})();
