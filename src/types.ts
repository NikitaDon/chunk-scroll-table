/** Configuration for a table column */
export interface ColumnDefinition<T = any> {
  /** Key in the data object (e.g. 'email', 'date') */
  key: string;
  /** Column header text */
  header: string;
  /** Optional render function. Receives the value and the full row.
   *  Returns a string that will be placed in the cell.
   *  Default: String(value) */
  render?: (value: any, row: T) => string;
  /** Optional CSS class for the column */
  className?: string;
}

/** Result returned by the user-provided fetchData function */
export interface FetchResult<T = any> {
  /** The loaded data rows */
  data: T[];
  /** Total number of rows in the dataset (used for navigation/clamping) */
  totalCount: number;
}

/** Main configuration for ChunkScrollTable */
export interface ChunkScrollTableOptions<T = any> {
  /** DOM element or CSS selector where the table will be rendered */
  container: HTMLElement | string;
  /** Column definitions */
  columns: ColumnDefinition<T>[];
  /** Async function that fetches data from the server.
   *  Receives offset (starting row) and count (how many rows).
   *  Must return { data, totalCount }. */
  fetchData: (offset: number, count: number) => Promise<FetchResult<T>>;
  /** Rows per chunk (default: 300) */
  chunkSize?: number;
  /** Row height in pixels (default: 42) */
  rowHeight?: number;
  /** Max chunks kept in cache (default: 2) */
  maxCachedChunks?: number;
  /** Optional navigation buttons (DOM elements or CSS selectors).
   *  If not provided, no button navigation will be set up. */
  buttons?: NavigationButtons;
  /** Callback when data is being loaded (e.g. for showing a spinner) */
  onLoading?: (isLoading: boolean) => void;
  /** Delay in ms before onLoading(true) is called (default: 120) */
  loadingDelay?: number;
  /** Text displayed when no data is available (default: 'No data found.') */
  noDataText?: string;
}

/** Navigation button references (DOM elements or CSS selectors) */
export interface NavigationButtons {
  first?: HTMLElement | string;
  prevPage?: HTMLElement | string;
  prevOne?: HTMLElement | string;
  nextOne?: HTMLElement | string;
  nextPage?: HTMLElement | string;
  last?: HTMLElement | string;
}

/** Auto-repeat configuration for hold-to-scroll */
export interface RepeatConfig {
  initialDelay: number;
  startInterval: number;
  accelFactor: number;
  accelEvery: number;
  minInterval: number;
}
