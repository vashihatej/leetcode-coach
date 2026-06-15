(async function () {
  const status = document.getElementById("status");
  const label = document.getElementById("label");
  const detail = document.getElementById("detail");

  try {
    const response = await fetch("http://localhost:8765/health");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body.ok) throw new Error("unhealthy response");
    status.classList.add("connected");
    label.textContent = "Coach connected";
    detail.textContent = "The local server is ready to receive LeetCode activity.";
  } catch {
    status.classList.add("disconnected");
    label.textContent = "Coach disconnected";
    detail.textContent = "Run npm start in the leetcode-coach repository.";
  }
})();
