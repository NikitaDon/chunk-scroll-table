import type { NavigationButtons } from "../../types.js";

/**
 * Creates a container div with a mocked clientHeight.
 * happy-dom has no layout engine, so we mock the height.
 */
export function createContainer(height: number = 420): HTMLElement {
  const container = document.createElement("div");
  container.id = "test-container";
  document.body.appendChild(container);

  Object.defineProperty(container, "clientHeight", {
    get: () => height,
    configurable: true,
  });

  return container;
}

/**
 * Creates 6 navigation buttons and appends them to document.body.
 * Returns a NavigationButtons object with the elements.
 */
export function createButtons(): {
  buttons: NavigationButtons;
  elements: Record<string, HTMLButtonElement>;
} {
  const names = [
    "first",
    "prevPage",
    "prevOne",
    "nextOne",
    "nextPage",
    "last",
  ] as const;
  const elements: Record<string, HTMLButtonElement> = {};
  const buttons: NavigationButtons = {};

  for (const name of names) {
    const btn = document.createElement("button");
    btn.id = `btn-${name}`;
    document.body.appendChild(btn);
    elements[name] = btn;
    (buttons as any)[name] = btn;
  }

  return { buttons, elements };
}

/**
 * Mocks offsetHeight on a thead element.
 */
export function mockTheadHeight(
  table: HTMLTableElement,
  height: number = 42
): void {
  const thead = table.querySelector("thead");
  if (thead) {
    Object.defineProperty(thead, "offsetHeight", {
      get: () => height,
      configurable: true,
    });
  }
}

/**
 * Mocks getBoundingClientRect on all <tr> elements in a tbody.
 */
export function mockRowHeight(tbody: HTMLTableSectionElement, height: number): void {
  const rows = tbody.querySelectorAll("tr");
  rows.forEach((row) => {
    Object.defineProperty(row, "getBoundingClientRect", {
      value: () => ({
        height,
        width: 0,
        top: 0,
        left: 0,
        bottom: height,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      configurable: true,
    });
  });
}

/**
 * Removes all test elements from the DOM.
 */
export function cleanupDOM(): void {
  document.body.innerHTML = "";
}
