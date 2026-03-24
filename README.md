# chunk-scroll-table

A lightweight, zero-dependency vanilla JS/TS library for rendering large tables with chunk-based server-side loading, smart prefetching, and button navigation.

Only the visible rows exist in the DOM. Data is loaded in chunks from the server, cached intelligently, and the next chunk is prefetched in the background before you need it.

---

## Option 1: Try the Demo

Clone the repo to see the library in action with 10,000 fake rows and a simulated server delay.

```bash
git clone <repo-url>
cd chunk-scroll-table
npm install
npm run build
npx serve .
```

Open **http://localhost:3000/demo/index.html** in your browser.

Press `Ctrl + C` in the terminal to stop the server.

### What to try in the demo
- Click the navigation buttons (First, Prev, Next, Last)
- **Hold** the single-step buttons to auto-scroll with acceleration
- Resize the browser window — the row count adapts automatically
- Watch the "Loading..." spinner appear briefly when crossing chunk boundaries

---

## Option 2: Use in Your Own Project

### Install

```bash
npm install chunk-scroll-table
```

### Minimal Example

```html
<div id="my-table" style="height: 500px;"></div>

<button id="btn-first">First</button>
<button id="btn-prev-page">Prev Page</button>
<button id="btn-prev-one">Prev</button>
<button id="btn-next-one">Next</button>
<button id="btn-next-page">Next Page</button>
<button id="btn-last">Last</button>
```

```ts
import { ChunkScrollTable } from 'chunk-scroll-table';

const table = new ChunkScrollTable({
  container: '#my-table',
  columns: [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'E-Mail' },
    { key: 'date', header: 'Date', render: (val) => new Date(val).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (val) => val === 200 ? 'OK' : 'Error' },
  ],
  fetchData: async (offset, count) => {
    const res = await fetch(`/api/logs?start=${offset}&count=${count}`);
    const json = await res.json();
    return { data: json.items, totalCount: json.total };
  },
  buttons: {
    first: '#btn-first',
    prevPage: '#btn-prev-page',
    prevOne: '#btn-prev-one',
    nextOne: '#btn-next-one',
    nextPage: '#btn-next-page',
    last: '#btn-last',
  },
  onLoading: (loading) => {
    document.getElementById('spinner')!.style.display = loading ? 'block' : 'none';
  },
});

table.load();
```

### The `fetchData` function

This is the only thing you need to implement. It receives `offset` (starting row) and `count` (how many rows to load), and must return `{ data, totalCount }`:

```ts
fetchData: async (offset, count) => {
  const res = await fetch(`/api/data?start=${offset}&count=${count}`);
  const json = await res.json();
  return {
    data: json.items,       // Array of row objects
    totalCount: json.total, // Total number of rows in the dataset
  };
}
```

The library handles everything else: caching, prefetching, chunk management, and rendering.

---

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `container` | `HTMLElement \| string` | *required* | Where the table is rendered |
| `columns` | `ColumnDefinition[]` | *required* | Column definitions |
| `fetchData` | `(offset, count) => Promise<FetchResult>` | *required* | Your data loading function |
| `chunkSize` | `number` | `300` | Rows per chunk |
| `rowHeight` | `number` | `42` | Row height in px |
| `maxCachedChunks` | `number` | `2` | Max chunks kept in memory |
| `buttons` | `NavigationButtons` | – | Navigation button elements or selectors |
| `onLoading` | `(isLoading: boolean) => void` | – | Called when loading state changes |
| `loadingDelay` | `number` | `120` | Delay in ms before `onLoading(true)` fires |
| `noDataText` | `string` | `'No data found.'` | Shown when dataset is empty |

### Column Definition

```ts
{
  key: string;                        // Key in your data object
  header: string;                     // Column header text
  render?: (value, row) => string;    // Custom cell renderer (optional)
  className?: string;                 // CSS class for the column (optional)
}
```

### Navigation Buttons

All buttons are optional. Provide the ones you need:

| Key | Action | Hold-to-repeat |
|---|---|---|
| `first` | Jump to first row | No |
| `prevPage` | Back by one page | No |
| `prevOne` | Back by one row | Yes (with acceleration) |
| `nextOne` | Forward by one row | Yes (with acceleration) |
| `nextPage` | Forward by one page | No |
| `last` | Jump to last row | No |

### Methods

| Method | Description |
|---|---|
| `table.load()` | Load initial data and render the table |
| `table.refresh(newFetchData?)` | Reload data (e.g. after a filter change) |
| `table.destroy()` | Remove all event listeners and clear the DOM |

---

## How It Works

1. **Chunk-based loading** — Data is fetched in configurable chunks (default 300 rows) via your `fetchData` function
2. **LRU cache** — Only 2 chunks are kept in memory at a time
3. **Smart prefetching** — The next chunk loads in the background when you scroll past the midpoint of the current chunk
4. **Request deduplication** — Duplicate in-flight requests are prevented automatically
5. **Hold-to-repeat** — Single-step buttons accelerate when held down

---

## Development

```bash
npm run build    # Compile TypeScript to dist/
npm run dev      # Watch mode (auto-rebuild on changes)
```

## License

MIT
