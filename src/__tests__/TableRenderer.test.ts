import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TableRenderer } from "../TableRenderer.js";
import {
  createContainer,
  cleanupDOM,
  mockTheadHeight,
  mockRowHeight,
} from "./helpers/dom.js";
import type { ColumnDefinition } from "../types.js";

const columns: ColumnDefinition[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "email", header: "E-Mail", className: "col-email" },
];

describe("TableRenderer", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer(420);
  });

  afterEach(() => {
    cleanupDOM();
  });

  // ─── Constructor ─────────────────────────────────────────────

  describe("constructor", () => {
    it("creates table with thead and tbody inside the container", () => {
      new TableRenderer(container, columns);

      const table = container.querySelector("table");
      expect(table).not.toBeNull();
      expect(table!.querySelector("thead")).not.toBeNull();
      expect(table!.querySelector("tbody")).not.toBeNull();
    });

    it("generates correct number of th elements", () => {
      new TableRenderer(container, columns);

      const ths = container.querySelectorAll("thead th");
      expect(ths).toHaveLength(3);
      expect(ths[0].textContent).toBe("ID");
      expect(ths[1].textContent).toBe("Name");
      expect(ths[2].textContent).toBe("E-Mail");
    });

    it("creates a hidden no-data element", () => {
      new TableRenderer(container, columns);

      const noData = container.querySelector("div");
      expect(noData).not.toBeNull();
      expect(noData!.style.display).toBe("none");
      expect(noData!.textContent).toBe("No data found.");
    });

    it("uses custom noDataText", () => {
      new TableRenderer(container, columns, 42, "Keine Daten.");

      const noData = container.querySelector("div");
      expect(noData!.textContent).toBe("Keine Daten.");
    });

    it("sets container styles", () => {
      new TableRenderer(container, columns);

      expect(container.style.overflowY).toBe("auto");
      expect(container.style.position).toBe("relative");
    });

    it("clears pre-existing container content", () => {
      container.innerHTML = "<p>Old content</p>";
      new TableRenderer(container, columns);

      expect(container.querySelector("p")).toBeNull();
      expect(container.querySelector("table")).not.toBeNull();
    });
  });

  // ─── render ──────────────────────────────────────────────────

  describe("render", () => {
    it("creates the correct number of rows", () => {
      const renderer = new TableRenderer(container, columns);
      const data = [
        { id: 1, name: "Alice", email: "a@b.com" },
        { id: 2, name: "Bob", email: "b@b.com" },
        { id: 3, name: "Charlie", email: "c@b.com" },
      ];
      renderer.render(data);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(3);
    });

    it("each row has the correct number of cells", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([{ id: 1, name: "Alice", email: "a@b.com" }]);

      const cells = container.querySelectorAll("tbody tr td");
      expect(cells).toHaveLength(3);
    });

    it("cell text matches String(row[col.key]) by default", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([{ id: 42, name: "Alice", email: "a@b.com" }]);

      const cells = container.querySelectorAll("tbody tr td");
      expect(cells[0].textContent).toBe("42");
      expect(cells[1].textContent).toBe("Alice");
      expect(cells[2].textContent).toBe("a@b.com");
    });

    it("uses custom render function when provided", () => {
      const colsWithRender: ColumnDefinition[] = [
        {
          key: "status",
          header: "Status",
          render: (val) => (val === 200 ? "OK" : "Error"),
        },
      ];
      const renderer = new TableRenderer(container, colsWithRender);
      renderer.render([{ status: 200 }, { status: 400 }]);

      const cells = container.querySelectorAll("tbody tr td");
      expect(cells[0].textContent).toBe("OK");
      expect(cells[1].textContent).toBe("Error");
    });

    it("passes full row to render function", () => {
      const colsWithRow: ColumnDefinition[] = [
        {
          key: "name",
          header: "Full",
          render: (val, row) => `${val} (${row.id})`,
        },
      ];
      const renderer = new TableRenderer(container, colsWithRow);
      renderer.render([{ id: 5, name: "Alice" }]);

      const cell = container.querySelector("tbody td");
      expect(cell!.textContent).toBe("Alice (5)");
    });

    it("handles undefined/null values gracefully", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([{ id: 1, name: undefined, email: null }]);

      const cells = container.querySelectorAll("tbody td");
      expect(cells[1].textContent).toBe("");
      expect(cells[2].textContent).toBe("");
    });

    it("applies col.className to td", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([{ id: 1, name: "A", email: "a@b.com" }]);

      const emailCell = container.querySelectorAll("tbody td")[2];
      expect(emailCell.classList.contains("col-email")).toBe(true);
    });

    it("shows no-data message when entries is empty", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([]);

      const noData = container.querySelector("div");
      expect(noData!.style.display).toBe("block");
    });

    it("hides no-data message when entries is non-empty", () => {
      const renderer = new TableRenderer(container, columns);
      // First render empty to show no-data
      renderer.render([]);
      // Then render with data
      renderer.render([{ id: 1, name: "A", email: "a@b.com" }]);

      const noData = container.querySelector("div");
      expect(noData!.style.display).toBe("none");
    });

    it("clears previous rows when called again", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([
        { id: 1, name: "A", email: "a" },
        { id: 2, name: "B", email: "b" },
      ]);
      expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

      renderer.render([{ id: 3, name: "C", email: "c" }]);
      expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    });

    it("sets row height style", () => {
      const renderer = new TableRenderer(container, columns, 30);
      renderer.render([{ id: 1, name: "A", email: "a" }]);

      const row = container.querySelector("tbody tr") as HTMLElement;
      expect(row.style.height).toBe("30px");
      expect(row.style.maxHeight).toBe("30px");
    });
  });

  // ─── getVisibleRowCount ─────────────────────────────────────

  describe("getVisibleRowCount", () => {
    it("returns correct count based on container and thead height", () => {
      // container=420px, rowHeight=42
      const renderer = new TableRenderer(container, columns, 42);
      const table = container.querySelector("table") as HTMLTableElement;
      mockTheadHeight(table, 42);

      // (420 - 42) / 42 = 9
      expect(renderer.getVisibleRowCount()).toBe(9);
    });

    it("returns at least 1", () => {
      const tinyContainer = createContainer(10);
      const renderer = new TableRenderer(tinyContainer, columns, 42);
      const table = tinyContainer.querySelector("table") as HTMLTableElement;
      mockTheadHeight(table, 42);

      // (10 - 42) / 42 = negative → max(1, ...) = 1
      expect(renderer.getVisibleRowCount()).toBe(1);
    });

    it("uses actual row getBoundingClientRect when rows exist", () => {
      const renderer = new TableRenderer(container, columns, 42);
      const table = container.querySelector("table") as HTMLTableElement;
      mockTheadHeight(table, 42);

      // Render some rows
      renderer.render([{ id: 1, name: "A", email: "a" }]);

      // Mock the actual row height to be 30px (different from configured 42px)
      const tbody = table.querySelector("tbody") as HTMLTableSectionElement;
      mockRowHeight(tbody, 30);

      // (420 - 42) / 30 = 12.6 → floor = 12
      expect(renderer.getVisibleRowCount()).toBe(12);
    });
  });

  // ─── destroy ────────────────────────────────────────────────

  describe("destroy", () => {
    it("empties the container", () => {
      const renderer = new TableRenderer(container, columns);
      renderer.render([{ id: 1, name: "A", email: "a" }]);

      renderer.destroy();
      expect(container.innerHTML).toBe("");
      expect(container.children).toHaveLength(0);
    });
  });
});
