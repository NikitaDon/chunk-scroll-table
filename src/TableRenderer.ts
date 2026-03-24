import type { ColumnDefinition } from "./types.js";

export class TableRenderer<T = any> {
  private container: HTMLElement;
  private columns: ColumnDefinition<T>[];
  private rowHeight: number;
  private noDataText: string;
  private tableEl: HTMLTableElement;
  private tbodyEl: HTMLTableSectionElement;
  private noDataEl: HTMLElement;

  constructor(
    container: HTMLElement,
    columns: ColumnDefinition<T>[],
    rowHeight: number = 42,
    noDataText: string = "No data found."
  ) {
    this.container = container;
    this.columns = columns;
    this.rowHeight = rowHeight;
    this.noDataText = noDataText;

    // Build table structure
    this.tableEl = document.createElement("table");
    this.tableEl.style.borderCollapse = "collapse";
    this.tableEl.style.width = "100%";

    // Table header
    const thead = document.createElement("thead");
    thead.style.position = "sticky";
    thead.style.top = "0";
    const headerRow = document.createElement("tr");
    for (const col of this.columns) {
      const th = document.createElement("th");
      th.textContent = col.header;
      th.style.padding = "10px";
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    this.tableEl.appendChild(thead);

    // Table body
    this.tbodyEl = document.createElement("tbody");
    this.tableEl.appendChild(this.tbodyEl);

    // No-data message
    this.noDataEl = document.createElement("div");
    this.noDataEl.textContent = this.noDataText;
    this.noDataEl.style.display = "none";
    this.noDataEl.style.textAlign = "center";
    this.noDataEl.style.padding = "20px";
    this.noDataEl.style.color = "#777";

    // Prepare container
    this.container.style.overflowY = "auto";
    this.container.style.position = "relative";
    this.container.innerHTML = "";
    this.container.appendChild(this.tableEl);
    this.container.appendChild(this.noDataEl);
  }

  /** Renders the visible rows into the table body */
  render(entries: T[]): void {
    this.tbodyEl.innerHTML = "";

    if (entries.length === 0) {
      this.noDataEl.style.display = "block";
      return;
    }

    this.noDataEl.style.display = "none";

    for (const row of entries) {
      const tr = document.createElement("tr");
      tr.style.height = `${this.rowHeight}px`;
      tr.style.maxHeight = `${this.rowHeight}px`;

      for (const col of this.columns) {
        const td = document.createElement("td");
        td.style.paddingRight = "10px";
        if (col.className) td.classList.add(col.className);

        const value = (row as any)[col.key];
        td.textContent = col.render ? col.render(value, row) : String(value ?? "");
        tr.appendChild(td);
      }

      this.tbodyEl.appendChild(tr);
    }
  }

  /** Calculates how many rows fit into the container.
   *  Measures the actual rendered row height if rows exist,
   *  otherwise falls back to the configured rowHeight. */
  getVisibleRowCount(): number {
    const containerHeight = this.container.clientHeight;
    const theadHeight = this.tableEl.querySelector("thead")?.offsetHeight ?? 42;
    const available = containerHeight - theadHeight;

    // Measure actual row height from DOM if possible (includes padding, borders)
    const firstRow = this.tbodyEl.querySelector("tr");
    const measuredHeight = firstRow ? firstRow.getBoundingClientRect().height : 0;
    const actualRowHeight = measuredHeight > 0 ? measuredHeight : this.rowHeight;

    return Math.max(1, Math.floor(available / actualRowHeight));
  }

  /** Removes all DOM elements from the container */
  destroy(): void {
    this.container.innerHTML = "";
  }
}
