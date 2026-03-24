import type { FetchResult } from "./types.js";

export class ChunkManager<T = any> {
  private chunkSize: number;
  private maxCachedChunks: number;
  private fetchData: (offset: number, count: number) => Promise<FetchResult<T>>;
  private chunkCache: Map<number, T[]> = new Map();
  private chunkPromises: Map<number, Promise<T[]>> = new Map();
  private totalCount: number = 0;

  constructor(
    fetchData: (offset: number, count: number) => Promise<FetchResult<T>>,
    chunkSize: number = 300,
    maxCachedChunks: number = 2
  ) {
    this.fetchData = fetchData;
    this.chunkSize = chunkSize;
    this.maxCachedChunks = maxCachedChunks;
  }

  /** Returns visible entries for the given range. Loads missing chunks on demand. */
  async getVisibleEntries(startIndex: number, count: number): Promise<T[]> {
    if (count <= 0) return [];

    const end = startIndex + count;
    const startChunk = Math.floor(startIndex / this.chunkSize);
    const endChunk = Math.floor((end - 1) / this.chunkSize);

    // Determine which chunks are required
    const required: number[] = [];
    for (let i = startChunk; i <= endChunk; i++) required.push(i);

    const missing = required.filter(
      (i) => !this.chunkCache.has(i) && !this.chunkPromises.has(i)
    );

    // Load missing chunks
    if (missing.length > 0) {
      const loads = missing.map((i) => {
        let p = this.chunkPromises.get(i);
        if (!p) {
          p = this.fetchChunk(i)
            .then((data) => {
              this.chunkCache.set(i, data);
              return data;
            })
            .finally(() => this.chunkPromises.delete(i));
          this.chunkPromises.set(i, p);
        }
        return p;
      });
      await Promise.all(loads);
    }

    // Evict old chunks: only keep the ones needed for the current view
    const requiredSet = new Set(required);
    if (this.chunkCache.size > this.maxCachedChunks) {
      const keys = [...this.chunkCache.keys()];
      for (const k of keys) {
        if (!requiredSet.has(k)) {
          this.chunkCache.delete(k);
        }
      }
    }

    // Build visible entries from cached chunks
    const entries: T[] = [];
    for (let i = startIndex; i < end; i++) {
      const chunkIndex = Math.floor(i / this.chunkSize);
      const localIndex = i % this.chunkSize;
      const chunk = this.chunkCache.get(chunkIndex);
      if (chunk && chunk[localIndex]) entries.push(chunk[localIndex]);
    }

    return entries;
  }

  /** Prefetches the next chunk in the background when in the lower half of the current chunk */
  prefetchIfNeeded(currentIndex: number, visibleCount: number): void {
    const midIndex = currentIndex + Math.floor(visibleCount / 2);
    const inLowerHalf = (midIndex % this.chunkSize) > (this.chunkSize / 2);
    const nextChunkIndex = Math.floor(midIndex / this.chunkSize) + 1;
    const beyondEnd = nextChunkIndex * this.chunkSize >= this.totalCount;

    if (
      inLowerHalf &&
      !beyondEnd &&
      !this.chunkCache.has(nextChunkIndex) &&
      !this.chunkPromises.has(nextChunkIndex)
    ) {
      const p = this.fetchChunk(nextChunkIndex)
        .then((data) => {
          this.chunkCache.set(nextChunkIndex, data);
        })
        .catch((e) =>
          console.warn(`[ChunkManager] Prefetch chunk ${nextChunkIndex} failed:`, e)
        )
        .finally(() => this.chunkPromises.delete(nextChunkIndex));
      this.chunkPromises.set(nextChunkIndex, p as unknown as Promise<T[]>);
    }
  }

  /** Clears the cache and optionally sets initial data */
  reset(initialData?: T[], totalCount?: number): void {
    this.chunkCache.clear();
    this.chunkPromises.clear();
    if (initialData) {
      this.chunkCache.set(0, initialData);
    }
    if (typeof totalCount === "number") {
      this.totalCount = totalCount;
    }
  }

  getTotalCount(): number {
    return this.totalCount;
  }

  hasData(): boolean {
    return this.totalCount > 0 && this.chunkCache.size > 0;
  }

  /** Fetches a single chunk from the server */
  private async fetchChunk(chunkIndex: number): Promise<T[]> {
    const offset = chunkIndex * this.chunkSize;
    const result = await this.fetchData(offset, this.chunkSize);
    const data = result.data || [];

    if (typeof result.totalCount === "number") {
      this.totalCount = result.totalCount;
    } else if (data.length < this.chunkSize) {
      this.totalCount = chunkIndex * this.chunkSize + data.length;
    }

    return data;
  }
}
