import { ChunkManager } from "./ChunkManager.js";
import { TableRenderer } from "./TableRenderer.js";
import { NavigationController } from "./NavigationController.js";
import type { ChunkScrollTableOptions, FetchResult } from "./types.js";

export class ChunkScrollTable<T = any> {
  private chunkManager: ChunkManager<T>;
  private renderer: TableRenderer<T>;
  private navigation: NavigationController | null = null;
  private currentIndex: number = 0;
  private visibleCount: number = 15;
  private onLoading?: (isLoading: boolean) => void;
  private onError: (error: unknown) => void;
  private loadingDelay: number;
  private resizeHandler: (() => void) | null = null;
  private renderGeneration: number = 0;

  constructor(private options: ChunkScrollTableOptions<T>) {
    // Resolve container (selector or element)
    const container =
      typeof options.container === "string"
        ? document.querySelector<HTMLElement>(options.container)
        : options.container;
    if (!container) throw new Error(`Container not found: ${options.container}`);

    this.onLoading = options.onLoading;
    this.onError = options.onError ?? ((e) => console.error("[ChunkScrollTable]", e));
    this.loadingDelay = options.loadingDelay ?? 120;

    // Initialize modules
    this.chunkManager = new ChunkManager<T>(
      options.fetchData,
      options.chunkSize ?? 300,
      options.maxCachedChunks ?? 2
    );

    this.renderer = new TableRenderer<T>(
      container,
      options.columns,
      options.rowHeight ?? 42,
      options.noDataText ?? "No data found."
    );

    // Navigation (optional)
    if (options.buttons) {
      this.navigation = new NavigationController(
        options.buttons,
        (newIndex) => this.navigateTo(newIndex),
        () => ({
          currentIndex: this.currentIndex,
          visibleCount: this.visibleCount,
          totalCount: this.chunkManager.getTotalCount(),
        })
      );
    }

    // Recalculate visible rows on window resize
    this.resizeHandler = async () => {
      this.visibleCount = this.renderer.getVisibleRowCount();
      if (!this.chunkManager.hasData()) return;
      this.clampIndex();
      await this.renderView();
      // Re-measure after render in case row height changed
      const measuredCount = this.renderer.getVisibleRowCount();
      if (measuredCount !== this.visibleCount) {
        this.visibleCount = measuredCount;
        this.clampIndex();
        await this.renderView();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
  }

  /** Load initial data and render the table */
  async load(): Promise<void> {
    const spinnerTimer = this.showSpinnerDelayed();
    try {
      this.currentIndex = 0;
      this.visibleCount = this.renderer.getVisibleRowCount();
      await this.renderView();

      // After first render, measure actual row height and re-render if count changed
      const measuredCount = this.renderer.getVisibleRowCount();
      if (measuredCount !== this.visibleCount) {
        this.visibleCount = measuredCount;
        this.clampIndex();
        await this.renderView();
      }

      this.navigation?.updateDisabled();
    } finally {
      this.hideSpinner(spinnerTimer);
    }
  }

  /** Reload data (e.g. after a filter change). Optionally pass a new fetchData function. */
  async refresh(
    newFetchData?: (offset: number, count: number) => Promise<FetchResult<T>>
  ): Promise<void> {
    if (newFetchData) {
      this.chunkManager = new ChunkManager<T>(
        newFetchData,
        this.options.chunkSize ?? 300,
        this.options.maxCachedChunks ?? 2
      );
    }
    this.chunkManager.reset();
    this.currentIndex = 0;
    this.visibleCount = this.renderer.getVisibleRowCount();
    await this.load();
  }

  /** Clean up: remove event listeners and clear the DOM */
  destroy(): void {
    this.navigation?.destroy();
    this.renderer.destroy();
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
  }

  /** Navigate to a new index. Returns true if movement occurred. */
  private async navigateTo(newIndex: number): Promise<boolean> {
    const before = this.currentIndex;
    this.currentIndex = newIndex;
    this.clampIndex();
    const moved = this.currentIndex !== before;
    try {
      await this.renderView();
    } catch (e) {
      // Revert index on error so the table stays in a consistent state
      this.currentIndex = before;
      this.onError(e);
    }
    return moved;
  }

  /** Clamp current index to valid range */
  private clampIndex(): void {
    const total = this.chunkManager.getTotalCount();
    const maxStart = Math.max(0, total - this.visibleCount);
    this.currentIndex = Math.max(0, Math.min(maxStart, this.currentIndex));
  }

  /** Load visible entries and render them.
   *  Uses a generation counter to discard stale renders from rapid clicks. */
  private async renderView(): Promise<void> {
    const generation = ++this.renderGeneration;
    const entries = await this.chunkManager.getVisibleEntries(
      this.currentIndex,
      this.visibleCount
    );
    // If a newer renderView was started while we were loading, discard this result
    if (generation !== this.renderGeneration) return;
    this.renderer.render(entries);
    this.chunkManager.prefetchIfNeeded(this.currentIndex, this.visibleCount);
    this.navigation?.updateDisabled();
  }

  /** Show loading indicator with a delay */
  private showSpinnerDelayed(): ReturnType<typeof setTimeout> | null {
    if (!this.onLoading) return null;
    return setTimeout(() => this.onLoading!(true), this.loadingDelay);
  }

  /** Hide loading indicator */
  private hideSpinner(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) clearTimeout(timer);
    this.onLoading?.(false);
  }
}

// Re-exports
export type {
  ChunkScrollTableOptions,
  ColumnDefinition,
  FetchResult,
  NavigationButtons,
  RepeatConfig,
} from "./types.js";
