export function shouldCaptureUrl(url) {
  // LeetCode polls /submissions/detail/<id>/check/ — newer flows insert a /v2/ segment.
  return /\/submissions\/detail\/\d+\/(?:v\d+\/)?check\/?/.test(url || "");
}

export function parseVerdict(json) {
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
