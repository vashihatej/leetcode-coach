import { describe, it, expect, vi } from "vitest";
import { debounce } from "../../extension/src/debounce.js";

describe("debounce", () => {
  it("calls once with the latest args after the quiet period", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(spy, 1000);
    d("a");
    d("b");
    d("c");
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("c");
    vi.useRealTimers();
  });
});
