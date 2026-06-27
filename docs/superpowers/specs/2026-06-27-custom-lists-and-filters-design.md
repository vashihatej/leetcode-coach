# Custom Problem Lists + Problems Tab Filters — Design Spec
**Date:** 2026-06-27

## Overview

Two independent features:
1. **Custom Problem Lists** — named curated sets (e.g. NeetCode 75) that live as a new tab inside the Wishlist page. Every problem added to any list also lands in the main wishlist (the ocean / rivers metaphor).
2. **Problems Tab Filters** — upgrade the current single difficulty dropdown into a full filter bar covering Difficulty, Patterns, and Comfort, with multi-select everywhere.

---

## Feature 1: Custom Problem Lists

### Data Model

Two new tables added to `coach.db`:

```sql
CREATE TABLE problem_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE list_problems (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id      INTEGER NOT NULL REFERENCES problem_lists(id) ON DELETE CASCADE,
  problem_id   INTEGER REFERENCES problems(id),  -- null if slug not yet in problems
  slug         TEXT NOT NULL,
  title        TEXT,
  url          TEXT,
  difficulty   TEXT,
  pattern_tags TEXT,  -- JSON array e.g. ["hashing", "two-pointers"]
  UNIQUE(list_id, slug)
);
```

- `list_problems` uses `ON DELETE CASCADE` so deleting a list removes its membership rows but never touches `wishlist` or `problems`.
- `problem_id` is nullable — filled lazily if the slug already exists in `problems`, otherwise null until the user practices it.
- `pattern_tags` is list-local tagging, separate from `pattern_problems` (which tracks coached attempts).
- Data structure tags (Singly Linked List, Queue, etc.) are stored in `pattern_tags` alongside algorithm patterns but never rendered in the UI.

### Input Format

Free-text block pasted by the user:

```
Singly Linked Lists
https://leetcode.com/problems/reverse-linked-list/
https://leetcode.com/problems/merge-two-sorted-lists/

Doubly Linked Lists
https://leetcode.com/problems/design-linked-list/

Queues
https://leetcode.com/problems/number-of-students-unable-to-eat-lunch/
```

**Parse rules:**
- A line without `http` → new current pattern name (trimmed)
- A line containing `http` → URL belonging to the current pattern
- A URL appearing under multiple pattern blocks → its `pattern_tags` array merges all pattern names
- Slug extracted from the URL path segment (e.g. `reverse-linked-list`)
- Blank lines ignored

### Backend — New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists` | All lists: `{ id, name, created_at, problem_count }` |
| POST | `/api/lists` | Create list: body `{ name }` |
| GET | `/api/lists/:id/problems` | Problems in list, each with `pattern_tags`, `slug`, `title`, `url`, `difficulty` |
| POST | `/api/lists/:id/problems/bulk` | Parse free-text block, insert rows, auto-upsert into `wishlist` |
| DELETE | `/api/lists/:id` | Delete list + cascade `list_problems`; wishlist entries are NOT removed |

**Bulk insert logic (server-side):**
1. Parse free-text into `[{ pattern, urls[] }]` groups.
2. Merge patterns per slug into a single `pattern_tags` array.
3. Extract `slug` from each URL.
4. Lookup `problems` table for existing metadata (title, difficulty); use null if not found.
5. Upsert each slug into `wishlist` (existing `addWishlist` logic).
6. Insert into `list_problems` with `ON CONFLICT(list_id, slug) DO UPDATE SET pattern_tags`.

### UI — Wishlist Page

**Tabs added to `Wishlist.tsx`:** "Wishlist" (existing, unchanged) | "Lists" (new)

**Lists tab:**
- Top bar: `[ + New List ]` button
- Each list renders as a collapsible card: name + problem count + delete `×`
- Inside each card: problems grouped by pattern label rows, then problem entries (title + external link icon) under each label
- Problems with multiple patterns appear under each of their patterns

**New List modal:**
- Name text input (required, must be unique)
- Large `<textarea>` with placeholder showing the expected format
- `Create List` button — runs parse → bulk insert → closes modal
- Inline error if: name is blank, name already exists, or no URLs were found in the paste

**New components:**
- `dashboard/src/pages/Wishlist.tsx` — add tab state
- `dashboard/src/components/wishlist/ListsTab.tsx` — list of list cards
- `dashboard/src/components/wishlist/ListCard.tsx` — single expandable list card
- `dashboard/src/components/wishlist/NewListModal.tsx` — create modal

**New hooks:**
- `useLists()` — GET `/api/lists`
- `useListProblems(id)` — GET `/api/lists/:id/problems`
- `useCreateList()` — POST `/api/lists`
- `useBulkAddToList(id)` — POST `/api/lists/:id/problems/bulk`
- `useDeleteList()` — DELETE `/api/lists/:id`

**New API client methods** added to `api.ts`:
```ts
lists: () => get<ProblemList[]>('/api/lists')
listProblems: (id) => get<ListProblem[]>(`/api/lists/${id}/problems`)
createList: (name) => post('/api/lists', { name })
bulkAddToList: (id, text) => post(`/api/lists/${id}/problems/bulk`, { text })
deleteList: (id) => del(`/api/lists/${id}`)
```

**New types** in `types.ts`:
```ts
interface ProblemList { id: number; name: string; created_at: string; problem_count: number; }
interface ListProblem { id: number; slug: string; title: string | null; url: string | null; difficulty: string | null; pattern_tags: string | null; }
```

---

## Feature 2: Problems Tab Filters

### Filter Dimensions

| Dimension | UI Control | Values | Logic |
|-----------|-----------|--------|-------|
| Search | Text input (existing) | Free text | name contains search string |
| Difficulty | Multi-select dropdown | Easy / Medium / Hard | OR within dimension |
| Patterns | Multi-select dropdown | Dynamic from all patterns in table | OR within dimension |
| Comfort | Chip toggles (always visible) | instinct / solid / learning / shaky / new | OR within dimension |

**Cross-dimension logic:** AND (all active filters must match simultaneously).

### Comfort Mapping

`ComfortBadge` derives comfort from attempt data. The filter uses the same derivation:
- `instinct` — last attempt solved + instinct fired
- `solid` — last attempt solved + result optimal, no instinct
- `learning` — last attempt solved + result brute
- `shaky` — last attempt not solved
- `new` — no attempts

### UI Layout

```
[ Search...                    ] [ Difficulty ▾ ] [ Patterns ▾ ] [ Clear all ]
Comfort: [ instinct ] [ solid ] [ learning ] [ shaky ] [ new ]
─── active chips: [ shaky × ] [ hashing × ] ───────────────────────────────
```

- **Dropdown multi-selects** (Difficulty, Patterns): open a small panel with checkboxes; header shows count when active (`Patterns (2) ▾`)
- **Comfort chips:** always rendered row; dim (#374151) when inactive, indigo (`bg-indigo-900/40 text-indigo-300 border-indigo-700`) when active
- **Active filter chips row:** rendered only when at least one filter is active; each chip is dismissible with `×`
- **Clear all:** text button, appears only when any filter is active

### Implementation

All filtering in `ProblemTable.tsx` via `useMemo` — no new API endpoints. The `Problem` type already carries `patterns` (JSON array string) and enough data to derive comfort.

**Changes to `ProblemTable.tsx`:**
- Replace `diffFilter: string` with `diffFilter: string[]`, `patternFilter: string[]`, `comfortFilter: string[]`
- Extract comfort derivation from `ComfortBadge` into a shared `getComfortLevel(problem: Problem): ComfortLevel` utility in `dashboard/src/lib/comfort.ts` — used by both the badge and the filter
- Add `MultiSelectDropdown` component (reusable, used for both Difficulty and Patterns)
- Add `ComfortChips` inline component
- Add `ActiveFilterChips` inline component
- `filtered` useMemo expands to check all three dimensions

**New component:** `dashboard/src/components/problems/MultiSelectDropdown.tsx`
- Props: `label`, `options: string[]`, `selected: string[]`, `onChange`
- Renders a button that toggles a dropdown panel with checkboxes
- Shows count badge when `selected.length > 0`

---

## Out of Scope

- Reordering problems within a list
- Importing lists from LeetCode directly (no LeetCode API)
- Filtering the Lists tab itself
- Sorting columns in the Problems table
