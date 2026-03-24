import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChunkManager } from "../ChunkManager.js";
import { createFakeFetch } from "./helpers/fakeFetch.js";

describe("ChunkManager", () => {
  let fetchData: ReturnType<typeof createFakeFetch>;

  beforeEach(() => {
    fetchData = createFakeFetch({ totalCount: 100 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Constructor ─────────────────────────────────────────────

  describe("constructor", () => {
    it("initializes with default values", () => {
      const cm = new ChunkManager(fetchData);
      expect(cm.getTotalCount()).toBe(0);
      expect(cm.hasData()).toBe(false);
    });
  });

  // ─── getVisibleEntries ───────────────────────────────────────

  describe("getVisibleEntries", () => {
    it("fetches the correct chunk when cache is empty", async () => {
      const cm = new ChunkManager(fetchData, 10);
      await cm.getVisibleEntries(0, 5);

      expect(fetchData).toHaveBeenCalledTimes(1);
      expect(fetchData).toHaveBeenCalledWith(0, 10);
    });

    it("returns the correct data slice from a single chunk", async () => {
      const cm = new ChunkManager(fetchData, 10);
      const entries = await cm.getVisibleEntries(2, 3);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({ id: 2, name: "Row 2" });
      expect(entries[1]).toEqual({ id: 3, name: "Row 3" });
      expect(entries[2]).toEqual({ id: 4, name: "Row 4" });
    });

    it("spans two chunks when visible range crosses a boundary", async () => {
      const cm = new ChunkManager(fetchData, 10);
      const entries = await cm.getVisibleEntries(8, 5);

      expect(fetchData).toHaveBeenCalledTimes(2);
      expect(fetchData).toHaveBeenCalledWith(0, 10); // chunk 0
      expect(fetchData).toHaveBeenCalledWith(10, 10); // chunk 1
      expect(entries).toHaveLength(5);
      expect(entries[0]).toEqual({ id: 8, name: "Row 8" });
      expect(entries[4]).toEqual({ id: 12, name: "Row 12" });
    });

    it("does not re-fetch a chunk already in cache", async () => {
      const cm = new ChunkManager(fetchData, 10);
      await cm.getVisibleEntries(0, 5);
      await cm.getVisibleEntries(3, 5);

      expect(fetchData).toHaveBeenCalledTimes(1);
    });

    it("deduplicates in-flight requests for the same chunk", async () => {
      const slowFetch = createFakeFetch({ totalCount: 100, delay: 50 });
      const cm = new ChunkManager(slowFetch, 10);

      // Fire two requests simultaneously for the same chunk
      const p1 = cm.getVisibleEntries(0, 5);
      const p2 = cm.getVisibleEntries(3, 5);
      await Promise.all([p1, p2]);

      expect(slowFetch).toHaveBeenCalledTimes(1);
    });

    it("evicts old chunks when cache exceeds maxCachedChunks", async () => {
      const cm = new ChunkManager(fetchData, 10, 2);

      // Load chunk 0
      await cm.getVisibleEntries(0, 5);
      // Load chunk 1
      await cm.getVisibleEntries(10, 5);
      // Load chunk 2 — should evict chunk 0
      await cm.getVisibleEntries(20, 5);

      expect(fetchData).toHaveBeenCalledTimes(3);

      // Now request chunk 0 again — should need a new fetch
      await cm.getVisibleEntries(0, 5);
      expect(fetchData).toHaveBeenCalledTimes(4);
    });

    it("handles a partial last chunk correctly", async () => {
      // totalCount=25, chunkSize=10 → chunk 2 has only 5 rows
      const fetch25 = createFakeFetch({ totalCount: 25 });
      const cm = new ChunkManager(fetch25, 10);

      const entries = await cm.getVisibleEntries(20, 10);
      expect(entries).toHaveLength(5);
      expect(entries[0]).toEqual({ id: 20, name: "Row 20" });
      expect(entries[4]).toEqual({ id: 24, name: "Row 24" });
    });

    it("returns empty array when startIndex is beyond totalCount", async () => {
      const cm = new ChunkManager(fetchData, 10);
      // First load to establish totalCount
      await cm.getVisibleEntries(0, 5);

      const entries = await cm.getVisibleEntries(200, 5);
      expect(entries).toHaveLength(0);
    });

    it("propagates fetchData errors", async () => {
      const failFetch = createFakeFetch({ totalCount: 100, failOnCalls: [0] });
      const cm = new ChunkManager(failFetch, 10);

      await expect(cm.getVisibleEntries(0, 5)).rejects.toThrow(
        "Simulated fetch error"
      );
    });

    it("handles count = 0", async () => {
      const cm = new ChunkManager(fetchData, 10);
      const entries = await cm.getVisibleEntries(0, 0);

      // Should not fetch anything
      expect(fetchData).not.toHaveBeenCalled();
      expect(entries).toHaveLength(0);
    });

    it("works with chunkSize = 1", async () => {
      const cm = new ChunkManager(fetchData, 1);
      const entries = await cm.getVisibleEntries(0, 3);

      expect(fetchData).toHaveBeenCalledTimes(3);
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({ id: 0, name: "Row 0" });
      expect(entries[2]).toEqual({ id: 2, name: "Row 2" });
    });
  });

  // ─── totalCount tracking ────────────────────────────────────

  describe("totalCount tracking", () => {
    it("updates totalCount from fetch result", async () => {
      const cm = new ChunkManager(fetchData, 10);
      expect(cm.getTotalCount()).toBe(0);

      await cm.getVisibleEntries(0, 5);
      expect(cm.getTotalCount()).toBe(100);
    });

    it("infers totalCount from partial last chunk", async () => {
      // fetchData returns 5 rows for a chunkSize of 10 → total = 0*10 + 5
      // But our fakeFetch always returns totalCount, so we create a custom one
      const customFetch = vi.fn(async (offset: number, count: number) => {
        const data = [{ id: 0, name: "A" }, { id: 1, name: "B" }];
        // Return without totalCount to test inference
        return { data, totalCount: undefined as any };
      });
      const cm = new ChunkManager(customFetch, 10);
      await cm.getVisibleEntries(0, 5);

      // 2 rows < chunkSize 10 → inferred total = 0 * 10 + 2 = 2
      expect(cm.getTotalCount()).toBe(2);
    });
  });

  // ─── prefetchIfNeeded ───────────────────────────────────────

  describe("prefetchIfNeeded", () => {
    it("does NOT prefetch when in the upper half of a chunk", async () => {
      const cm = new ChunkManager(fetchData, 100);
      await cm.getVisibleEntries(0, 10);

      fetchData.mockClear();
      // currentIndex=0, visibleCount=10 → midIndex=5, 5%100=5 < 50 → upper half
      cm.prefetchIfNeeded(0, 10);

      expect(fetchData).not.toHaveBeenCalled();
    });

    it("DOES prefetch when in the lower half of a chunk", async () => {
      const cm = new ChunkManager(fetchData, 20);
      await cm.getVisibleEntries(0, 10);

      fetchData.mockClear();
      // currentIndex=10, visibleCount=10 → midIndex=15, 15%20=15 > 10 → lower half
      cm.prefetchIfNeeded(10, 10);

      // Should have started a fetch for chunk 1
      expect(fetchData).toHaveBeenCalledTimes(1);
      expect(fetchData).toHaveBeenCalledWith(20, 20);
    });

    it("does NOT prefetch if next chunk is already cached", async () => {
      const cm = new ChunkManager(fetchData, 10);
      // Load chunks 0 and 1
      await cm.getVisibleEntries(0, 15);

      fetchData.mockClear();
      // In lower half of chunk 0, but chunk 1 already cached
      cm.prefetchIfNeeded(5, 10);

      expect(fetchData).not.toHaveBeenCalled();
    });

    it("does NOT prefetch beyond totalCount", async () => {
      const fetch20 = createFakeFetch({ totalCount: 20 });
      const cm = new ChunkManager(fetch20, 20);
      await cm.getVisibleEntries(0, 10);

      fetch20.mockClear();
      // totalCount=20, chunkSize=20 → chunk 1 starts at 20 which is >= totalCount
      cm.prefetchIfNeeded(10, 10);

      expect(fetch20).not.toHaveBeenCalled();
    });

    it("catches and logs prefetch errors", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Create a fetch that succeeds for chunk 0, then always fails
      let callCount = 0;
      const failingFetch = vi.fn(async (offset: number, count: number) => {
        callCount++;
        if (callCount > 1) throw new Error("Prefetch failed");
        const data = Array.from({ length: count }, (_, i) => ({
          id: offset + i,
          name: `Row ${offset + i}`,
        }));
        return { data, totalCount: 100 };
      });

      const cm = new ChunkManager(failingFetch, 20);
      await cm.getVisibleEntries(0, 10);

      // currentIndex=10, visibleCount=10 → midIndex=15, 15%20=15 > 10 → lower half
      // nextChunkIndex = floor(15/20)+1 = 1, 1*20=20 < 100 → will prefetch
      cm.prefetchIfNeeded(10, 10);

      // Wait for background promise to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Prefetch chunk"),
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  // ─── reset ──────────────────────────────────────────────────

  describe("reset", () => {
    it("clears cache and promises", async () => {
      const cm = new ChunkManager(fetchData, 10);
      await cm.getVisibleEntries(0, 5);
      expect(cm.hasData()).toBe(true);

      cm.reset();
      expect(cm.hasData()).toBe(false);
    });

    it("seeds chunk 0 with initialData", () => {
      const cm = new ChunkManager(fetchData, 10);
      const seed = [{ id: 0, name: "Seed" }];
      cm.reset(seed, 1);

      expect(cm.hasData()).toBe(true);
      expect(cm.getTotalCount()).toBe(1);
    });

    it("sets totalCount when provided", () => {
      const cm = new ChunkManager(fetchData, 10);
      cm.reset(undefined, 500);
      expect(cm.getTotalCount()).toBe(500);
    });
  });

  // ─── hasData ────────────────────────────────────────────────

  describe("hasData", () => {
    it("returns false after construction", () => {
      const cm = new ChunkManager(fetchData, 10);
      expect(cm.hasData()).toBe(false);
    });

    it("returns true after successful fetch", async () => {
      const cm = new ChunkManager(fetchData, 10);
      await cm.getVisibleEntries(0, 5);
      expect(cm.hasData()).toBe(true);
    });

    it("returns false after reset without initialData", async () => {
      const cm = new ChunkManager(fetchData, 10);
      await cm.getVisibleEntries(0, 5);
      cm.reset();
      expect(cm.hasData()).toBe(false);
    });
  });
});
