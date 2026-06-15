(function (root) {
  function readEditorCode(monaco) {
    if (!monaco || !monaco.editor) return null;
    const models = monaco.editor.getModels();
    if (!models || models.length === 0) return null;
    const model =
      models.find((candidate) => candidate.getLanguageId() !== "plaintext") || models[0];
    if (!model) return null;
    return { code: model.getValue(), language: model.getLanguageId() };
  }

  function shouldCaptureUrl(url) {
    return /\/submissions\/detail\/\d+\/(?:v\d+\/)?check\/?/.test(url || "");
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
        json.compile_error ||
        json.full_compile_error ||
        json.runtime_error ||
        json.full_runtime_error ||
        null,
    };
  }

  root.LeetCodeCoachBridgeRuntime = Object.freeze({
    readEditorCode,
    shouldCaptureUrl,
    parseVerdict,
  });
})(globalThis);
