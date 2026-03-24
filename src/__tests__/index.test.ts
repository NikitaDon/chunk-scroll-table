import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChunkScrollTable } from "../index.js";
import { createFakeFetch } from "./helpers/fakeFetch.js";
import {
  createContainer,
  createButtons,
  cleanupDOM,
  mockTheadHeight,
} from "./helpers/dom.js";
import type { ColumnDefinition } from "../types.js";

const columns: ColumnDefinition[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
];

describe("ChunkScrollTable", () => {
  let container: HTMLElement;
  let fetchData: ReturnType<typeof createFakeFetch>;

  beforeEach(() => {
    container = createContainer(420);
    fetchData = createFakeFetch({ totalCount: 100 });
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Mock thead height after ChunkScrollTable created the table */
  function patchThead() {
    const table = container.querySelector("table") as HTMLTableElement;
    if (table) mockTheadHeight(table, 42);
  }

  // ─── Constructor ─────────────────────────────────────────────

  describe("constructor", () => {
    it("resolves container from CSS selector", () => {
      const table = new ChunkScrollTable({
        container: "#test-container",
        columns,
        fetchData,
      });
      expect(container.querySelector("table")).not.toBeNull();
      table.destroy();
    });

    it("resolves container from HTMLElement", () => {
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
      });
      expect(container.querySelector("table")).not.toBeNull();
      table.destroy();
    });

    it("throws when container is not found", () => {
      expect(
        () =>
          new ChunkScrollTable({
            container: "#nonexistent",
            columns,
            fetchData,
          })
      ).toThrow("Container not found");
    });
  });

  // ─── load ────────────────────────────────────────────────────

  describe("load", () => {
    it("fetches and renders initial data", async () => {
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
      });
      patchThead();

      await table.load();

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBeGreaterThan(0);
      expect(fetchData).toHaveBeenCalled();
      table.destroy();
    });

    it("calls updateDisabled on navigation buttons", async () => {
      const { buttons, elements } = createButtons();
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
        buttons,
      });
      patchThead();

      await table.load();

      // At index 0: backward buttons should be disabled
      expect(elements.first.disabled).toBe(true);
      expect(elements.prevOne.disabled).toBe(true);
      table.destroy();
    });
  });

  // ─── Loading indicator ──────────────────────────────────────

  describe("loading indicator", () => {
    it("always calls onLoading(false) on completion", async () => {
      const onLoading = vi.fn();
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
        onLoading,
      });
      patchThead();

      await table.load();

      const lastCall = onLoading.mock.calls[onLoading.mock.calls.length - 1];
      expect(lastCall[0]).toBe(false);
      table.destroy();
    });

    it("does NOT call onLoading(true) if fetch completes instantly", async () => {
      const onLoading = vi.fn();
      const instantFetch = createFakeFetch({ totalCount: 100, delay: 0 });
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData: instantFetch,
        chunkSize: 50,
        loadingDelay: 5000, // Very long delay so it never triggers
        onLoading,
      });
      patchThead();

      await table.load();

      const trueCalls = onLoading.mock.calls.filter(
        (c: any[]) => c[0] === true
      );
      expect(trueCalls).toHaveLength(0);
      table.destroy();
    });
  });

  // ─── refresh ─────────────────────────────────────────────────

  describe("refresh", () => {
    it("resets cache and reloads data", async () => {
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
      });
      patchThead();

      await table.load();
      const callsBefore = fetchData.mock.calls.length;

      await table.refresh();

      expect(fetchData.mock.calls.length).toBeGreaterThan(callsBefore);
      table.destroy();
    });

    it("accepts a new fetchData function", async () => {
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
      });
      patchThead();

      await table.load();

      const newFetch = createFakeFetch({ totalCount: 50 });
      await table.refresh(newFetch);

      expect(newFetch).toHaveBeenCalled();
      table.destroy();
    });
  });

  // ─── Navigation integration ──────────────────────────────────

  describe("navigation integration", () => {
    it("navigates forward via nextPage button", async () => {
      const { buttons, elements } = createButtons();
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
        buttons,
      });
      patchThead();

      await table.load();

      const firstRowBefore = container.querySelector("tbody td")?.textContent;

      elements.nextPage.click();
      // Wait for async render
      await new Promise((r) => setTimeout(r, 50));

      const firstRowAfter = container.querySelector("tbody td")?.textContent;
      expect(firstRowAfter).not.toBe(firstRowBefore);
      table.destroy();
    });
  });

  // ─── Resize ──────────────────────────────────────────────────

  describe("resize", () => {
    it("does not render if no data loaded yet", () => {
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
      });
      patchThead();

      // Trigger resize before load — should not crash or fetch
      window.dispatchEvent(new Event("resize"));

      expect(fetchData).not.toHaveBeenCalled();
      table.destroy();
    });
  });

  // ─── destroy ─────────────────────────────────────────────────

  describe("destroy", () => {
    it("cleans up DOM and event listeners", async () => {
      const { buttons } = createButtons();
      const table = new ChunkScrollTable({
        container,
        columns,
        fetchData,
        chunkSize: 50,
        buttons,
      });
      patchThead();

      await table.load();
      table.destroy();

      expect(container.innerHTML).toBe("");
    });
  });
});
