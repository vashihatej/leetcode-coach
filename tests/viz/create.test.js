// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Viz } from "../../public/viz/viz-kit.js";

beforeEach(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  document.body.innerHTML = `
    <div id="controls"></div>
    <pre id="code"></pre>
    <div id="state"></div>
    <div id="note"></div>
    <div id="stage"></div>`;
});

function setup() {
  const render = vi.fn();
  const stepper = Viz.create({
    controls: document.getElementById("controls"),
    frameCount: 3,
    render,
    codeEl: document.getElementById("code"),
    source: "a\nb\nc",
    lineForFrame: (i) => i,
    stateEl: document.getElementById("state"),
    stateRows: (i) => [["i", String(i)]],
    noteEl: document.getElementById("note"),
    note: (i) => `note${i}`,
  });
  return { render, stepper };
}

describe("Viz.create", () => {
  it("builds controls, counter, and code lines and paints frame 0", () => {
    const { render } = setup();
    const buttons = document.querySelectorAll("#controls button");
    expect(buttons.length).toBe(4);
    expect(document.querySelector(".viz-counter").textContent).toBe("1 / 3");
    const lines = document.querySelectorAll(".viz-code-line");
    expect(lines.length).toBe(3);
    expect(lines[0].classList.contains("viz-code-line--current")).toBe(true);
    expect(document.querySelector(".viz-state-key").textContent).toBe("i");
    expect(document.getElementById("note").textContent).toBe("note0");
    expect(render).toHaveBeenCalledWith(0, 1);
  });

  it("updates panels synchronously when the index changes", () => {
    const { stepper } = setup();
    stepper.next();
    expect(document.querySelector(".viz-counter").textContent).toBe("2 / 3");
    const lines = document.querySelectorAll(".viz-code-line");
    expect(lines[1].classList.contains("viz-code-line--current")).toBe(true);
    expect(lines[0].classList.contains("viz-code-line--current")).toBe(false);
    expect(document.getElementById("note").textContent).toBe("note1");
    expect(document.querySelector(".viz-state-val").textContent).toBe("1");
  });
});
