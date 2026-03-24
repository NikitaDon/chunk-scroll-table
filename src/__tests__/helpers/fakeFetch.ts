import { vi } from "vitest";
import type { FetchResult } from "../../types.js";

export interface FakeRow {
  id: number;
  name: string;
}

export interface FakeFetchOptions {
  /** Total number of rows in the dataset (default: 1000) */
  totalCount?: number;
  /** Simulated delay in ms (default: 0 = instant) */
  delay?: number;
  /** Throw an error on these call indices (0-based) */
  failOnCalls?: number[];
}

/**
 * Creates a mock fetchData function that generates rows on-the-fly.
 * Returns a vi.fn() so you can inspect call history.
 */
export function createFakeFetch(options: FakeFetchOptions = {}) {
  const { totalCount = 1000, delay = 0, failOnCalls = [] } = options;
  let callIndex = 0;

  const fn = vi.fn(
    async (offset: number, count: number): Promise<FetchResult<FakeRow>> => {
      const currentCall = callIndex++;

      if (failOnCalls.includes(currentCall)) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        throw new Error(`Simulated fetch error on call ${currentCall}`);
      }

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      // Generate rows, capped at totalCount
      const end = Math.min(offset + count, totalCount);
      const data: FakeRow[] = [];
      for (let i = offset; i < end; i++) {
        data.push({ id: i, name: `Row ${i}` });
      }

      return { data, totalCount };
    }
  );

  return fn;
}
