import type { NavigationButtons, RepeatConfig } from "./types.js";

const DEFAULT_REPEAT: RepeatConfig = {
  initialDelay: 300,
  startInterval: 250,
  accelFactor: 0.95,
  accelEvery: 8,
  minInterval: 100,
};

type StateGetter = () => { currentIndex: number; visibleCount: number; totalCount: number };
type NavigateCallback = (newIndex: number) => Promise<boolean>;

export class NavigationController {
  private onNavigate: NavigateCallback;
  private getState: StateGetter;
  private repeat: RepeatConfig;
  private holdActive: boolean = false;
  private holdLoopRunning: boolean = false;
  private cleanupFns: (() => void)[] = [];
  private buttons: Map<string, HTMLElement> = new Map();

  constructor(
    buttonRefs: NavigationButtons,
    onNavigate: NavigateCallback,
    getState: StateGetter,
    repeat?: Partial<RepeatConfig>
  ) {
    this.onNavigate = onNavigate;
    this.getState = getState;
    this.repeat = { ...DEFAULT_REPEAT, ...repeat };

    // Resolve button references (selector -> element)
    const names = ["first", "prevPage", "prevOne", "nextOne", "nextPage", "last"] as const;
    for (const name of names) {
      const ref = buttonRefs[name];
      if (!ref) continue;
      const el = typeof ref === "string" ? document.querySelector<HTMLElement>(ref) : ref;
      if (el) this.buttons.set(name, el);
    }

    this.setupListeners();
    this.updateDisabled();
  }

  private setupListeners(): void {
    const { buttons } = this;
    const on = (el: HTMLElement, event: string, fn: EventListener) => {
      el.addEventListener(event, fn);
      this.cleanupFns.push(() => el.removeEventListener(event, fn));
    };

    const first = buttons.get("first");
    if (first) on(first, "click", () => this.goTo(0));

    const prevPage = buttons.get("prevPage");
    if (prevPage) on(prevPage, "click", () => {
      const s = this.getState();
      this.goTo(s.currentIndex - s.visibleCount);
    });

    const nextPage = buttons.get("nextPage");
    if (nextPage) on(nextPage, "click", () => {
      const s = this.getState();
      this.goTo(s.currentIndex + s.visibleCount);
    });

    const last = buttons.get("last");
    if (last) on(last, "click", () => {
      const s = this.getState();
      this.goTo(Math.max(0, s.totalCount - s.visibleCount));
    });

    // Prev one: click for single step, hold for auto-repeat
    const prevOne = buttons.get("prevOne");
    if (prevOne) {
      on(prevOne, "click", () => {
        const s = this.getState();
        this.goTo(s.currentIndex - 1);
      });
      on(prevOne, "mousedown", () => this.startAutoRepeat(-1));
      on(prevOne, "touchstart", (e) => { e.preventDefault(); this.startAutoRepeat(-1); });
      for (const evt of ["mouseup", "mouseleave"]) on(prevOne, evt, () => this.stopAutoRepeat());
      for (const evt of ["touchend", "touchcancel"]) on(prevOne, evt, () => this.stopAutoRepeat());
    }

    // Next one: click for single step, hold for auto-repeat
    const nextOne = buttons.get("nextOne");
    if (nextOne) {
      on(nextOne, "click", () => {
        const s = this.getState();
        this.goTo(s.currentIndex + 1);
      });
      on(nextOne, "mousedown", () => this.startAutoRepeat(1));
      on(nextOne, "touchstart", (e) => { e.preventDefault(); this.startAutoRepeat(1); });
      for (const evt of ["mouseup", "mouseleave"]) on(nextOne, evt, () => this.stopAutoRepeat());
      for (const evt of ["touchend", "touchcancel"]) on(nextOne, evt, () => this.stopAutoRepeat());
    }

    // Stop auto-repeat when window loses focus
    const blurFn = () => this.stopAutoRepeat();
    window.addEventListener("blur", blurFn);
    this.cleanupFns.push(() => window.removeEventListener("blur", blurFn));
  }

  private async goTo(index: number): Promise<void> {
    await this.onNavigate(index);
    this.updateDisabled();
  }

  private async startAutoRepeat(delta: number): Promise<void> {
    if (this.holdLoopRunning) return;
    this.holdActive = true;
    this.holdLoopRunning = true;

    await this.sleep(this.repeat.initialDelay);
    if (!this.holdActive) { this.holdLoopRunning = false; return; }

    let interval = this.repeat.startInterval;
    let count = 0;

    while (this.holdActive) {
      const s = this.getState();
      const moved = await this.onNavigate(s.currentIndex + delta);
      this.updateDisabled();
      if (!moved) break;

      count++;
      if (count % this.repeat.accelEvery === 0) {
        interval = Math.max(this.repeat.minInterval, Math.floor(interval * this.repeat.accelFactor));
      }
      await this.sleep(interval);
    }

    this.holdActive = false;
    this.holdLoopRunning = false;
  }

  private stopAutoRepeat(): void {
    this.holdActive = false;
  }

  /** Updates the disabled state of all navigation buttons */
  updateDisabled(): void {
    const s = this.getState();
    let atStart: boolean, atEnd: boolean;

    if (s.totalCount <= 0) {
      atStart = true;
      atEnd = true;
    } else {
      atStart = s.currentIndex <= 0;
      atEnd = s.currentIndex >= Math.max(0, s.totalCount - s.visibleCount);
    }

    const setDisabled = (name: string, disabled: boolean) => {
      const btn = this.buttons.get(name) as HTMLButtonElement | undefined;
      if (btn) btn.disabled = disabled;
    };

    setDisabled("first", atStart);
    setDisabled("prevPage", atStart);
    setDisabled("prevOne", atStart);
    setDisabled("nextOne", atEnd);
    setDisabled("nextPage", atEnd);
    setDisabled("last", atEnd);
  }

  /** Removes all event listeners */
  destroy(): void {
    this.stopAutoRepeat();
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
