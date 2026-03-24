import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NavigationController } from "../NavigationController.js";
import { createButtons, cleanupDOM } from "./helpers/dom.js";

function createState(initial: {
  currentIndex: number;
  visibleCount: number;
  totalCount: number;
}) {
  const state = { ...initial };
  return {
    state,
    getState: () => ({ ...state }),
  };
}

describe("NavigationController", () => {
  let elements: Record<string, HTMLButtonElement>;
  let onNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const created = createButtons();
    elements = created.elements;
    onNavigate = vi.fn(async () => true);
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── Button resolution ──────────────────────────────────────

  describe("button resolution", () => {
    it("resolves buttons from HTMLElement references", () => {
      const { state, getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { first: elements.first, last: elements.last },
        onNavigate,
        getState
      );

      elements.last.click();
      expect(onNavigate).toHaveBeenCalledWith(90); // 100 - 10
      nav.destroy();
    });

    it("resolves buttons from CSS selectors", async () => {
      const { state, getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 100,
      });
      // Resolve via selectors — verify the Nav finds the buttons in the DOM
      const nav = new NavigationController(
        { first: `#${elements.first.id}`, last: `#${elements.last.id}` },
        onNavigate,
        getState
      );

      // Verify the Nav resolved the selector by checking disabled state was applied
      // At index 0 with totalCount > 0, "first" should be disabled
      expect(elements.first.disabled).toBe(true);
      // "last" should not be disabled
      expect(elements.last.disabled).toBe(false);
      nav.destroy();
    });

    it("ignores missing buttons without error", () => {
      const { getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 100,
      });

      expect(() => {
        const nav = new NavigationController(
          { first: "#nonexistent" },
          onNavigate,
          getState
        );
        nav.destroy();
      }).not.toThrow();
    });
  });

  // ─── Click handlers ─────────────────────────────────────────

  describe("click handlers", () => {
    it("first → onNavigate(0)", () => {
      const { getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { first: elements.first },
        onNavigate,
        getState
      );

      elements.first.click();
      expect(onNavigate).toHaveBeenCalledWith(0);
      nav.destroy();
    });

    it("prevPage → onNavigate(currentIndex - visibleCount)", () => {
      const { getState } = createState({
        currentIndex: 30,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { prevPage: elements.prevPage },
        onNavigate,
        getState
      );

      elements.prevPage.click();
      expect(onNavigate).toHaveBeenCalledWith(20);
      nav.destroy();
    });

    it("nextPage → onNavigate(currentIndex + visibleCount)", () => {
      const { getState } = createState({
        currentIndex: 30,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { nextPage: elements.nextPage },
        onNavigate,
        getState
      );

      elements.nextPage.click();
      expect(onNavigate).toHaveBeenCalledWith(40);
      nav.destroy();
    });

    it("last → onNavigate(totalCount - visibleCount)", () => {
      const { getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { last: elements.last },
        onNavigate,
        getState
      );

      elements.last.click();
      expect(onNavigate).toHaveBeenCalledWith(90);
      nav.destroy();
    });

    it("prevOne → onNavigate(currentIndex - 1)", () => {
      const { getState } = createState({
        currentIndex: 5,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { prevOne: elements.prevOne },
        onNavigate,
        getState
      );

      elements.prevOne.click();
      expect(onNavigate).toHaveBeenCalledWith(4);
      nav.destroy();
    });

    it("nextOne → onNavigate(currentIndex + 1)", () => {
      const { getState } = createState({
        currentIndex: 5,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.click();
      expect(onNavigate).toHaveBeenCalledWith(6);
      nav.destroy();
    });
  });

  // ─── updateDisabled ─────────────────────────────────────────

  describe("updateDisabled", () => {
    it("disables backward buttons at index 0", () => {
      const { getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        {
          first: elements.first,
          prevPage: elements.prevPage,
          prevOne: elements.prevOne,
          nextOne: elements.nextOne,
          nextPage: elements.nextPage,
          last: elements.last,
        },
        onNavigate,
        getState
      );

      expect(elements.first.disabled).toBe(true);
      expect(elements.prevPage.disabled).toBe(true);
      expect(elements.prevOne.disabled).toBe(true);
      expect(elements.nextOne.disabled).toBe(false);
      expect(elements.nextPage.disabled).toBe(false);
      expect(elements.last.disabled).toBe(false);
      nav.destroy();
    });

    it("disables forward buttons at last page", () => {
      const { getState } = createState({
        currentIndex: 90,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        {
          first: elements.first,
          prevPage: elements.prevPage,
          prevOne: elements.prevOne,
          nextOne: elements.nextOne,
          nextPage: elements.nextPage,
          last: elements.last,
        },
        onNavigate,
        getState
      );

      expect(elements.first.disabled).toBe(false);
      expect(elements.prevPage.disabled).toBe(false);
      expect(elements.prevOne.disabled).toBe(false);
      expect(elements.nextOne.disabled).toBe(true);
      expect(elements.nextPage.disabled).toBe(true);
      expect(elements.last.disabled).toBe(true);
      nav.destroy();
    });

    it("disables all buttons when totalCount <= 0", () => {
      const { getState } = createState({
        currentIndex: 0,
        visibleCount: 10,
        totalCount: 0,
      });
      const nav = new NavigationController(
        {
          first: elements.first,
          prevOne: elements.prevOne,
          nextOne: elements.nextOne,
          last: elements.last,
        },
        onNavigate,
        getState
      );

      expect(elements.first.disabled).toBe(true);
      expect(elements.prevOne.disabled).toBe(true);
      expect(elements.nextOne.disabled).toBe(true);
      expect(elements.last.disabled).toBe(true);
      nav.destroy();
    });

    it("enables all buttons in the middle", () => {
      const { getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        {
          first: elements.first,
          prevPage: elements.prevPage,
          prevOne: elements.prevOne,
          nextOne: elements.nextOne,
          nextPage: elements.nextPage,
          last: elements.last,
        },
        onNavigate,
        getState
      );

      expect(elements.first.disabled).toBe(false);
      expect(elements.prevPage.disabled).toBe(false);
      expect(elements.prevOne.disabled).toBe(false);
      expect(elements.nextOne.disabled).toBe(false);
      expect(elements.nextPage.disabled).toBe(false);
      expect(elements.last.disabled).toBe(false);
      nav.destroy();
    });
  });

  // ─── Auto-repeat ────────────────────────────────────────────

  describe("auto-repeat", () => {
    it("mousedown starts repeat after initialDelay", async () => {
      vi.useFakeTimers();
      const { state, getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      // Update state on navigate so the loop progresses
      onNavigate.mockImplementation(async (idx: number) => {
        state.currentIndex = idx;
        return true;
      });
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.dispatchEvent(new MouseEvent("mousedown"));

      // Before initialDelay (300ms) — only the click handler fired
      expect(onNavigate).toHaveBeenCalledTimes(0);

      // Advance past initialDelay
      await vi.advanceTimersByTimeAsync(300);

      // First repeat should have happened
      expect(onNavigate).toHaveBeenCalled();

      // Stop
      elements.nextOne.dispatchEvent(new MouseEvent("mouseup"));
      nav.destroy();
    });

    it("mouseup stops auto-repeat", async () => {
      vi.useFakeTimers();
      const { state, getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      onNavigate.mockImplementation(async (idx: number) => {
        state.currentIndex = idx;
        return true;
      });
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.dispatchEvent(new MouseEvent("mousedown"));
      await vi.advanceTimersByTimeAsync(300);
      const callsAfterStart = onNavigate.mock.calls.length;

      // Release
      elements.nextOne.dispatchEvent(new MouseEvent("mouseup"));
      await vi.advanceTimersByTimeAsync(1000);

      // Should not have many more calls after mouseup
      expect(onNavigate.mock.calls.length).toBeLessThanOrEqual(
        callsAfterStart + 1
      );
      nav.destroy();
    });

    it("mouseleave stops auto-repeat", async () => {
      vi.useFakeTimers();
      const { state, getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      onNavigate.mockImplementation(async (idx: number) => {
        state.currentIndex = idx;
        return true;
      });
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.dispatchEvent(new MouseEvent("mousedown"));
      await vi.advanceTimersByTimeAsync(300);
      const callsAfterStart = onNavigate.mock.calls.length;

      elements.nextOne.dispatchEvent(new MouseEvent("mouseleave"));
      await vi.advanceTimersByTimeAsync(1000);

      expect(onNavigate.mock.calls.length).toBeLessThanOrEqual(
        callsAfterStart + 1
      );
      nav.destroy();
    });

    it("stops when onNavigate returns false (boundary)", async () => {
      vi.useFakeTimers();
      const { getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      // Return false immediately to simulate boundary
      onNavigate.mockResolvedValue(false);
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.dispatchEvent(new MouseEvent("mousedown"));
      await vi.advanceTimersByTimeAsync(600);

      // Should have stopped after first attempt returned false
      const totalCalls = onNavigate.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(onNavigate.mock.calls.length).toBe(totalCalls);

      nav.destroy();
    });

    it("window blur stops auto-repeat", async () => {
      vi.useFakeTimers();
      const { state, getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      onNavigate.mockImplementation(async (idx: number) => {
        state.currentIndex = idx;
        return true;
      });
      const nav = new NavigationController(
        { nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      elements.nextOne.dispatchEvent(new MouseEvent("mousedown"));
      await vi.advanceTimersByTimeAsync(300);

      window.dispatchEvent(new Event("blur"));
      const callsAfterBlur = onNavigate.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);

      expect(onNavigate.mock.calls.length).toBeLessThanOrEqual(
        callsAfterBlur + 1
      );
      nav.destroy();
    });
  });

  // ─── destroy ────────────────────────────────────────────────

  describe("destroy", () => {
    it("removes all event listeners", () => {
      const { getState } = createState({
        currentIndex: 50,
        visibleCount: 10,
        totalCount: 100,
      });
      const nav = new NavigationController(
        { first: elements.first, nextOne: elements.nextOne },
        onNavigate,
        getState
      );

      nav.destroy();

      // Clicks after destroy should not trigger onNavigate
      onNavigate.mockClear();
      elements.first.click();
      elements.nextOne.click();

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
