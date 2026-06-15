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

  it("supports multiple highlighted lines and keyboard navigation", () => {
    const render = vi.fn();
    const stepper = Viz.create({
      mount: document.getElementById("controls"),
      frameCount: 3,
      render,
      codeEl: document.getElementById("code"),
      code: { source: "a\nb\nc", lineForFrame: (i) => (i === 1 ? [0, 1] : i) },
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(stepper.index).toBe(1);
    const lines = document.querySelectorAll(".viz-code-line");
    expect(lines[0].classList.contains("viz-code-line--current")).toBe(true);
    expect(lines[1].classList.contains("viz-code-line--current")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(stepper.index).toBe(0);
    stepper.destroy();
  });

  it("exposes an optional Three.js module through threeReady", async () => {
    const fakeThree = { Scene: class Scene {} };
    const stepper = Viz.create({
      controls: document.getElementById("controls"),
      frameCount: 1,
      render: vi.fn(),
      three: fakeThree,
    });
    await expect(stepper.threeReady).resolves.toBe(fakeThree);
    stepper.destroy();
  });

  it("reset repaints frame zero even when the index is already zero", () => {
    const { render } = setup();
    const reset = document.querySelector('button[aria-label="Reset visualization"]');
    render.mockClear();
    reset.click();
    expect(render).toHaveBeenCalledWith(0, 1);
  });
});
