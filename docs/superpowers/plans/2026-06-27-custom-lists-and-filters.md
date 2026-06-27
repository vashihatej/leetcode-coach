# Custom Problem Lists + Problems Tab Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named custom problem lists (with pattern grouping) to the Wishlist page, and upgrade the Problems tab with multi-select filters for Difficulty, Patterns, and Comfort.

**Architecture:** Two independent feature slices. Lists: new DB tables → new queries → new Express routes → new React hooks + components → Wishlist page tabs. Filters: pure frontend — `useMemo` filter logic in `ProblemTable.tsx` + two new UI components.

**Tech Stack:** better-sqlite3, Express Router, React + TypeScript, TanStack Query v5, Tailwind CSS, Lucide icons.

## Global Constraints

- All DB tables use `CREATE TABLE IF NOT EXISTS` in `schema.sql` — `openDb` runs `db.exec(schema)` on every startup, so new tables self-migrate.
- All Express routes are added inside `createApiRouter(db)` in `src/server/api.js`.
- All React hooks use TanStack Query (`useQuery` / `useMutation`) — follow the pattern in `dashboard/src/hooks/useWishlist.ts` exactly.
- Comfort level derived via `computeComfort(problem)` from `dashboard/src/lib/comfort.ts` — already exists, do not recreate.
- No new npm packages.

---

## File Map

**New files:**
- `dashboard/src/hooks/useLists.ts` — TanStack Query hooks for lists
- `dashboard/src/components/wishlist/NewListModal.tsx` — create list modal
- `dashboard/src/components/wishlist/ListCard.tsx` — expandable list card grouped by pattern
- `dashboard/src/components/wishlist/ListsTab.tsx` — lists tab root
- `dashboard/src/components/problems/MultiSelectDropdown.tsx` — reusable multi-select

**Modified files:**
- `src/db/schema.sql` — add `problem_lists` + `list_problems` tables
- `src/db/queries.js` — add 5 list query functions
- `src/server/api.js` — add 5 list routes + `parseBulkText` helper
- `dashboard/src/lib/types.ts` — add `ProblemList` + `ListProblem` interfaces
- `dashboard/src/lib/api.ts` — add 5 list API methods
- `dashboard/src/pages/Wishlist.tsx` — add tab switcher
- `dashboard/src/components/problems/ProblemTable.tsx` — replace single diff filter with full filter bar

---

## Task 1: DB Schema — problem_lists + list_problems

**Files:**
- Modify: `src/db/schema.sql`

**Interfaces:**
- Produces: `problem_lists(id, name, created_at)` and `list_problems(id, list_id, problem_id, slug, title, url, difficulty, pattern_tags)` tables available to all subsequent tasks.

- [ ] **Step 1: Add tables to schema.sql**

Open `src/db/schema.sql` and append at the end:

```sql
CREATE TABLE IF NOT EXISTS problem_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_problems (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id      INTEGER NOT NULL REFERENCES problem_lists(id) ON DELETE CASCADE,
  problem_id   INTEGER REFERENCES problems(id),
  slug         TEXT NOT NULL,
  title        TEXT,
  url          TEXT,
  difficulty   TEXT,
  pattern_tags TEXT,
  UNIQUE(list_id, slug)
);
```

- [ ] **Step 2: Verify tables are created on next startup**

```bash
node -e "import('./src/db/index.js').then(m => { const db = m.openDb('./coach.db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('problem_lists','list_problems')\").all()); db.close(); })"
```

Expected output: `[ { name: 'problem_lists' }, { name: 'list_problems' } ]`

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat(db): add problem_lists and list_problems tables"
```

---

## Task 2: DB Queries — lists CRUD + bulk insert

**Files:**
- Modify: `src/db/queries.js`

**Interfaces:**
- Consumes: `problem_lists`, `list_problems`, `wishlist` tables from Task 1; `addToWishlist(db, {slug, url, title, difficulty})` already exists in queries.js.
- Produces:
  - `getLists(db)` → `Array<{id, name, created_at, problem_count}>`
  - `createList(db, name)` → `{id: number, name: string}`
  - `getListProblems(db, listId)` → `Array<{id, list_id, slug, title, url, difficulty, pattern_tags}>`
  - `bulkInsertListProblems(db, listId, problems)` → void; `problems` is `Array<{slug, url, pattern_tags: string[]}>`
  - `deleteList(db, listId)` → void

- [ ] **Step 1: Add the five query functions to src/db/queries.js**

Append at the end of `src/db/queries.js`:

```javascript
export function getLists(db) {
  return db.prepare(`
    SELECT pl.id, pl.name, pl.created_at,
           COUNT(lp.id) AS problem_count
    FROM problem_lists pl
    LEFT JOIN list_problems lp ON lp.list_id = pl.id
    GROUP BY pl.id
    ORDER BY pl.created_at DESC
  `).all();
}

export function createList(db, name) {
  const result = db.prepare('INSERT INTO problem_lists (name) VALUES (?)').run(name);
  return { id: result.lastInsertRowid, name };
}

export function getListProblems(db, listId) {
  return db.prepare(
    'SELECT * FROM list_problems WHERE list_id = ? ORDER BY id'
  ).all(listId);
}

export function bulkInsertListProblems(db, listId, problems) {
  const upsertLP = db.prepare(`
    INSERT INTO list_problems (list_id, slug, url, pattern_tags)
    VALUES (@listId, @slug, @url, @patternTags)
    ON CONFLICT(list_id, slug) DO UPDATE SET pattern_tags = excluded.pattern_tags
  `);
  const upsertW = db.prepare(`
    INSERT OR IGNORE INTO wishlist (slug, url) VALUES (@slug, @url)
  `);
  const run = db.transaction((probs) => {
    for (const p of probs) {
      upsertLP.run({ listId, slug: p.slug, url: p.url, patternTags: JSON.stringify(p.pattern_tags) });
      upsertW.run({ slug: p.slug, url: p.url ?? null });
    }
  });
  run(problems);
}

export function deleteList(db, listId) {
  db.prepare('DELETE FROM problem_lists WHERE id = ?').run(listId);
}
```

- [ ] **Step 2: Smoke-test in a node REPL**

```bash
node --input-type=module <<'EOF'
import { openDb } from './src/db/index.js';
import { createList, getLists, bulkInsertListProblems, getListProblems, deleteList } from './src/db/queries.js';
const db = openDb('./coach.db');
const list = createList(db, '__test_list__');
console.log('created:', list);
bulkInsertListProblems(db, list.id, [{ slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/', pattern_tags: ['hashing'] }]);
console.log('problems:', getListProblems(db, list.id));
console.log('lists:', getLists(db));
deleteList(db, list.id);
console.log('after delete:', getLists(db));
db.close();
EOF
```

Expected: created list prints, problems array has one entry, getLists shows it, after delete it's gone.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.js
git commit -m "feat(db): add list query functions"
```

---

## Task 3: API Routes — lists endpoints

**Files:**
- Modify: `src/server/api.js`

**Interfaces:**
- Consumes: `getLists`, `createList`, `getListProblems`, `bulkInsertListProblems`, `deleteList` from Task 2.
- Produces:
  - `GET  /api/lists` → `ProblemList[]`
  - `POST /api/lists` body `{name}` → `{id, name}`
  - `GET  /api/lists/:id/problems` → `ListProblem[]`
  - `POST /api/lists/:id/problems/bulk` body `{text}` → `{inserted: number}`
  - `DELETE /api/lists/:id` → `{ok: true}`

- [ ] **Step 1: Import new query functions in src/server/api.js**

Add the five new imports to the existing import block:

```javascript
import {
  // ... existing imports ...
  getLists,
  createList,
  getListProblems,
  bulkInsertListProblems,
  deleteList,
} from '../db/queries.js';
```

- [ ] **Step 2: Add parseBulkText helper before createApiRouter**

```javascript
function parseBulkText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const patternMap = {};   // slug -> Set<string>
  const urlMap = {};       // slug -> url string
  let currentPattern = null;

  for (const line of lines) {
    if (line.startsWith('http')) {
      if (!currentPattern) continue;
      const match = line.match(/problems\/([\w-]+)/);
      if (!match) continue;
      const slug = match[1];
      if (!patternMap[slug]) { patternMap[slug] = new Set(); urlMap[slug] = line; }
      patternMap[slug].add(currentPattern);
    } else {
      currentPattern = line;
    }
  }

  return Object.entries(patternMap).map(([slug, patterns]) => ({
    slug,
    url: urlMap[slug],
    pattern_tags: [...patterns],
  }));
}
```

- [ ] **Step 3: Add the five routes inside createApiRouter, before `return router`**

```javascript
  router.get('/lists', (_req, res) => res.json(getLists(db)));

  router.post('/lists', (req, res) => {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
    try {
      const list = createList(db, name.trim());
      res.json(list);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ ok: false, error: 'name already exists' });
      throw e;
    }
  });

  router.get('/lists/:id/problems', (req, res) =>
    res.json(getListProblems(db, Number(req.params.id)))
  );

  router.post('/lists/:id/problems/bulk', (req, res) => {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'text required' });
    const parsed = parseBulkText(text);
    if (!parsed.length) return res.status(400).json({ ok: false, error: 'no URLs found' });
    bulkInsertListProblems(db, Number(req.params.id), parsed);
    res.json({ inserted: parsed.length });
  });

  router.delete('/lists/:id', (req, res) => {
    deleteList(db, Number(req.params.id));
    res.json({ ok: true });
  });
```

- [ ] **Step 4: Manually test with curl (server must be running: `npm run dev`)**

```bash
# Create a list
curl -s -X POST http://localhost:8765/api/lists \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test List"}' | jq .

# Bulk add
curl -s -X POST http://localhost:8765/api/lists/1/problems/bulk \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hashing\nhttps://leetcode.com/problems/two-sum/"}' | jq .

# List all
curl -s http://localhost:8765/api/lists | jq .

# Get problems
curl -s http://localhost:8765/api/lists/1/problems | jq .

# Delete
curl -s -X DELETE http://localhost:8765/api/lists/1 | jq .
```

Expected: each returns valid JSON with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/api.js
git commit -m "feat(api): add lists CRUD and bulk-add endpoints"
```

---

## Task 4: Frontend Types + API Client

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/lib/api.ts`

**Interfaces:**
- Produces:
  - `ProblemList` interface
  - `ListProblem` interface
  - `api.lists()`, `api.listProblems(id)`, `api.createList(name)`, `api.bulkAddToList(id, text)`, `api.deleteList(id)`

- [ ] **Step 1: Add interfaces to types.ts**

Append at the end of `dashboard/src/lib/types.ts`:

```typescript
export interface ProblemList {
  id: number;
  name: string;
  created_at: string;
  problem_count: number;
}

export interface ListProblem {
  id: number;
  list_id: number;
  slug: string;
  title: string | null;
  url: string | null;
  difficulty: string | null;
  pattern_tags: string | null;
}
```

- [ ] **Step 2: Add import to api.ts and add five API methods**

Add `ProblemList, ListProblem` to the existing import in `dashboard/src/lib/api.ts`:

```typescript
import type {
  Problem, Attempt, Pattern, ReviewItem, ActivityPoint,
  Stats, WishlistItem, RecentAttempt, PatternWiki,
  ProblemList, ListProblem,
} from './types';
```

Then add to the `api` object:

```typescript
  lists: () => get<ProblemList[]>('/api/lists'),
  listProblems: (id: number) => get<ListProblem[]>(`/api/lists/${id}/problems`),
  createList: (name: string) => post<{ id: number; name: string }>('/api/lists', { name }),
  bulkAddToList: (id: number, text: string) =>
    post<{ inserted: number }>(`/api/lists/${id}/problems/bulk`, { text }),
  deleteList: (id: number) => del<{ ok: boolean }>(`/api/lists/${id}`),
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/api.ts
git commit -m "feat(client): add ProblemList types and list API methods"
```

---

## Task 5: useLists Hook

**Files:**
- Create: `dashboard/src/hooks/useLists.ts`

**Interfaces:**
- Consumes: `api.lists`, `api.listProblems`, `api.createList`, `api.bulkAddToList`, `api.deleteList` from Task 4.
- Produces:
  - `useLists()` → `UseQueryResult<ProblemList[]>`
  - `useListProblems(id: number | null)` → `UseQueryResult<ListProblem[]>`
  - `useCreateList()` → `UseMutationResult` with `mutateAsync(name: string) → {id, name}`
  - `useBulkAddToList()` → `UseMutationResult` with `mutateAsync({id: number, text: string})`
  - `useDeleteList()` → `UseMutationResult` with `mutate(id: number)`

- [ ] **Step 1: Create dashboard/src/hooks/useLists.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useLists() {
  return useQuery({ queryKey: ['lists'], queryFn: api.lists });
}

export function useListProblems(id: number | null) {
  return useQuery({
    queryKey: ['list-problems', id],
    queryFn: () => api.listProblems(id!),
    enabled: id != null,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createList(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useBulkAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => api.bulkAddToList(id, text),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['list-problems', id] });
      qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteList(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/hooks/useLists.ts
git commit -m "feat(hooks): add useLists, useCreateList, useBulkAddToList, useDeleteList"
```

---

## Task 6: NewListModal Component

**Files:**
- Create: `dashboard/src/components/wishlist/NewListModal.tsx`

**Interfaces:**
- Consumes: `useCreateList()`, `useBulkAddToList()` from Task 5.
- Props: `onClose: () => void`

- [ ] **Step 1: Create dashboard/src/components/wishlist/NewListModal.tsx**

```typescript
import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateList, useBulkAddToList } from '../../hooks/useLists';

interface Props {
  onClose: () => void;
}

const PLACEHOLDER = `Singly Linked Lists
https://leetcode.com/problems/reverse-linked-list/
https://leetcode.com/problems/merge-two-sorted-lists/

Hashing
https://leetcode.com/problems/two-sum/
https://leetcode.com/problems/group-anagrams/`;

export default function NewListModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createList = useCreateList();
  const bulkAdd = useBulkAddToList();
  const busy = createList.isPending || bulkAdd.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError('List name is required.'); return; }
    if (!text.trim()) { setError('Paste at least one problem URL.'); return; }
    try {
      const list = await createList.mutateAsync(name.trim());
      await bulkAdd.mutateAsync({ id: list.id, text });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg.includes('409') || msg.includes('already exists')
        ? 'A list with this name already exists.'
        : 'Failed to create list. Check the server logs.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">New Problem List</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="text"
            placeholder="List name (e.g. NeetCode 75)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <textarea
            placeholder={PLACEHOLDER}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={11}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none font-mono"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {busy ? 'Creating…' : 'Create List'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/wishlist/NewListModal.tsx
git commit -m "feat(ui): add NewListModal component"
```

---

## Task 7: ListCard Component

**Files:**
- Create: `dashboard/src/components/wishlist/ListCard.tsx`

**Interfaces:**
- Consumes: `useListProblems(id | null)`, `useDeleteList()` from Task 5; `ProblemList`, `ListProblem` from Task 4.
- Props: `list: ProblemList`

- [ ] **Step 1: Create dashboard/src/components/wishlist/ListCard.tsx**

```typescript
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import { useListProblems, useDeleteList } from '../../hooks/useLists';
import type { ProblemList, ListProblem } from '../../lib/types';

interface Props {
  list: ProblemList;
}

export default function ListCard({ list }: Props) {
  const [open, setOpen] = useState(false);
  const { data: problems = [], isLoading } = useListProblems(open ? list.id : null);
  const deleteList = useDeleteList();

  // Group problems by each of their pattern tags.
  const byPattern: Record<string, ListProblem[]> = {};
  for (const p of problems) {
    const tags: string[] = JSON.parse(p.pattern_tags ?? '[]');
    const groups = tags.length ? tags : ['Uncategorized'];
    for (const tag of groups) {
      if (!byPattern[tag]) byPattern[tag] = [];
      if (!byPattern[tag].some(x => x.slug === p.slug)) byPattern[tag].push(p);
    }
  }

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-800/60 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={14} className="text-gray-400" />
            : <ChevronRight size={14} className="text-gray-400" />
          }
          <span className="text-white font-medium">{list.name}</span>
          <span className="text-xs text-gray-500">{list.problem_count} problems</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); deleteList.mutate(list.id); }}
          title="Delete list"
          className="text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-gray-800/60">
          {isLoading && (
            <p className="px-4 py-3 text-xs text-gray-500">Loading…</p>
          )}
          {!isLoading && Object.entries(byPattern).map(([pattern, probs]) => (
            <div key={pattern} className="px-4 py-3">
              <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium mb-2">
                {pattern}
              </p>
              <div className="flex flex-wrap gap-2">
                {probs.map(p => (
                  <a
                    key={p.slug}
                    href={p.url ?? `https://leetcode.com/problems/${p.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                  >
                    {p.title ?? p.slug}
                    <ExternalLink size={10} className="text-gray-500" />
                  </a>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && problems.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-500">No problems in this list.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/wishlist/ListCard.tsx
git commit -m "feat(ui): add ListCard component with pattern grouping"
```

---

## Task 8: ListsTab + Wishlist Page Tabs

**Files:**
- Create: `dashboard/src/components/wishlist/ListsTab.tsx`
- Modify: `dashboard/src/pages/Wishlist.tsx`

**Interfaces:**
- Consumes: `useLists()` from Task 5; `ListCard` from Task 7; `NewListModal` from Task 6.

- [ ] **Step 1: Create dashboard/src/components/wishlist/ListsTab.tsx**

```typescript
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLists } from '../../hooks/useLists';
import ListCard from './ListCard';
import NewListModal from './NewListModal';

export default function ListsTab() {
  const { data: lists = [], isLoading } = useLists();
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          {lists.length} list{lists.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> New List
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {lists.map(l => <ListCard key={l.id} list={l} />)}
      </div>

      {!isLoading && lists.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-12">
          No lists yet. Hit "New List" to create one.
        </p>
      )}

      {showModal && <NewListModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Replace Wishlist.tsx with tabbed version**

```typescript
import { useState } from 'react';
import AddByUrl from '../components/wishlist/AddByUrl';
import WishlistGrid from '../components/wishlist/WishlistGrid';
import ListsTab from '../components/wishlist/ListsTab';

type Tab = 'wishlist' | 'lists';

export default function Wishlist() {
  const [tab, setTab] = useState<Tab>('wishlist');

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-gray-400 mt-1">
          Problems you want to tackle. Notes save on blur.
        </p>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-700">
        {(['wishlist', 'lists'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t === 'wishlist' ? 'All Problems' : 'Lists'}
          </button>
        ))}
      </div>

      {tab === 'wishlist' ? (
        <>
          <AddByUrl />
          <WishlistGrid />
        </>
      ) : (
        <ListsTab />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**
  - Open `http://localhost:5173` (or wherever the dev server runs)
  - Navigate to Wishlist — should see "All Problems" and "Lists" tabs
  - Switch to Lists tab — should show empty state + "New List" button
  - Click "New List" — modal opens
  - Enter name + paste a block with a pattern name and two LeetCode URLs
  - Click "Create List" — modal closes, list appears as a card
  - Click the card to expand — problems grouped under pattern label
  - Switch to "All Problems" tab — the URLs' slugs should appear in wishlist
  - Delete the list — card disappears, wishlist entries remain

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/wishlist/ListsTab.tsx dashboard/src/pages/Wishlist.tsx
git commit -m "feat(ui): add ListsTab and Wishlist page tabs"
```

---

## Task 9: MultiSelectDropdown Component

**Files:**
- Create: `dashboard/src/components/problems/MultiSelectDropdown.tsx`

**Interfaces:**
- Produces: `<MultiSelectDropdown label options selected onChange />` — consumed by Task 10.
- Props:
  ```typescript
  interface Props {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
  }
  ```

- [ ] **Step 1: Create dashboard/src/components/problems/MultiSelectDropdown.tsx**

```typescript
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  }

  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${
          active
            ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300'
            : 'bg-gray-800 border-gray-700 text-white hover:border-gray-600'
        }`}
      >
        {active ? `${label} (${selected.length})` : label}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 min-w-36 max-h-56 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">No options</p>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 cursor-pointer capitalize"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-indigo-500"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/problems/MultiSelectDropdown.tsx
git commit -m "feat(ui): add MultiSelectDropdown component"
```

---

## Task 10: ProblemTable Filter Upgrade

**Files:**
- Modify: `dashboard/src/components/problems/ProblemTable.tsx`

**Interfaces:**
- Consumes:
  - `computeComfort(problem)` from `../../lib/comfort` (already imported by ComfortBadge — import it here directly)
  - `MultiSelectDropdown` from `./MultiSelectDropdown` (Task 9)
  - `ComfortLevel` type from `../../lib/types`
  - `Problem` type already in scope

- [ ] **Step 1: Replace ProblemTable.tsx entirely**

```typescript
import { useState, useMemo, useRef, useEffect } from 'react';
import { ExternalLink, Plus, Play, X } from 'lucide-react';
import { useProblems } from '../../hooks/useProblems';
import { useAddWishlist } from '../../hooks/useWishlist';
import { computeComfort } from '../../lib/comfort';
import type { Problem, ComfortLevel } from '../../lib/types';
import ComfortBadge from './ComfortBadge';
import AttemptDrawer from './AttemptDrawer';
import MultiSelectDropdown from './MultiSelectDropdown';

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

const COMFORT_LEVELS: ComfortLevel[] = ['instinct', 'solid', 'learning', 'shaky', 'new'];
const COMFORT_ACTIVE = 'bg-indigo-900/40 border border-indigo-700 text-indigo-300';
const COMFORT_IDLE = 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600';

export default function ProblemTable() {
  const { data: problems = [], isLoading } = useProblems();
  const addWishlist = useAddWishlist();
  const [selected, setSelected] = useState<Problem | null>(null);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string[]>([]);
  const [patternFilter, setPatternFilter] = useState<string[]>([]);
  const [comfortFilter, setComfortFilter] = useState<string[]>([]);

  const allPatterns = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) {
      const tags: string[] = JSON.parse(p.patterns ?? '[]');
      tags.forEach(t => set.add(t));
    }
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() =>
    problems.filter(p => {
      const name = (p.title ?? p.slug).toLowerCase();
      const tags: string[] = JSON.parse(p.patterns ?? '[]');
      const comfort = computeComfort(p);
      return (
        (!search || name.includes(search.toLowerCase())) &&
        (!diffFilter.length || diffFilter.includes(p.difficulty ?? '')) &&
        (!patternFilter.length || tags.some(t => patternFilter.includes(t))) &&
        (!comfortFilter.length || comfortFilter.includes(comfort))
      );
    }),
    [problems, search, diffFilter, patternFilter, comfortFilter]
  );

  const hasFilters = diffFilter.length > 0 || patternFilter.length > 0 || comfortFilter.length > 0;

  function clearAll() {
    setDiffFilter([]);
    setPatternFilter([]);
    setComfortFilter([]);
  }

  function removeChip(type: 'diff' | 'pattern' | 'comfort', value: string) {
    if (type === 'diff') setDiffFilter(f => f.filter(x => x !== value));
    if (type === 'pattern') setPatternFilter(f => f.filter(x => x !== value));
    if (type === 'comfort') setComfortFilter(f => f.filter(x => x !== value));
  }

  const activeChips = [
    ...diffFilter.map(v => ({ label: v, type: 'diff' as const })),
    ...patternFilter.map(v => ({ label: v, type: 'pattern' as const })),
    ...comfortFilter.map(v => ({ label: v, type: 'comfort' as const })),
  ];

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading problems…</div>;

  return (
    <>
      <div className="p-6">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            placeholder="Search problems…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <MultiSelectDropdown
            label="Difficulty"
            options={['Easy', 'Medium', 'Hard']}
            selected={diffFilter}
            onChange={setDiffFilter}
          />
          <MultiSelectDropdown
            label="Patterns"
            options={allPatterns}
            selected={patternFilter}
            onChange={setPatternFilter}
          />
          {hasFilters && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Comfort chip row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 shrink-0">Comfort:</span>
          {COMFORT_LEVELS.map(level => (
            <button
              key={level}
              onClick={() =>
                setComfortFilter(f =>
                  f.includes(level) ? f.filter(x => x !== level) : [...f, level]
                )
              }
              className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                comfortFilter.includes(level) ? COMFORT_ACTIVE : COMFORT_IDLE
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeChips.map(({ label, type }) => (
              <span
                key={`${type}-${label}`}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-full"
              >
                {label}
                <button
                  onClick={() => removeChip(type, label)}
                  className="text-gray-500 hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60">
              <tr className="border-b border-gray-700 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Problem</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Comfort</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Next Review</th>
                <th className="px-4 py-3 font-medium">Patterns</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(p => {
                const tags: string[] = JSON.parse(p.patterns ?? '[]');
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{p.title ?? p.slug}</span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-gray-500 hover:text-indigo-400 transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${DIFF_COLOR[p.difficulty ?? ''] ?? 'text-gray-400'}`}>
                        {p.difficulty ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ComfortBadge problem={p} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{p.attempt_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.due_date ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map(t => (
                          <span
                            key={t}
                            className="text-xs bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.last_viz_path && (
                          <a
                            href={`http://localhost:8765/${p.last_viz_path}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open visualization"
                            onClick={e => e.stopPropagation()}
                            className="text-indigo-500 hover:text-indigo-300 transition-colors"
                          >
                            <Play size={13} />
                          </a>
                        )}
                        <button
                          title="Add to wishlist"
                          onClick={e => {
                            e.stopPropagation();
                            addWishlist.mutate({
                              slug: p.slug,
                              title: p.title ?? undefined,
                              difficulty: p.difficulty ?? undefined,
                              url: p.url ?? undefined,
                            });
                          }}
                          className="text-gray-600 hover:text-indigo-400 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">No problems match your filters.</p>
          )}
        </div>
      </div>
      <AttemptDrawer problem={selected} onClose={() => setSelected(null)} />
    </>
  );
}
```

- [ ] **Step 2: Manual smoke test**
  - Open Problems tab — should show search + Difficulty/Patterns dropdowns + Comfort chip row
  - Click a Comfort chip (e.g. "new") — table filters, chip row shows active state
  - Click Difficulty dropdown → check "Easy" → table filters, button shows "Difficulty (1)"
  - Click Patterns dropdown → check a pattern → table filters
  - Active filter chips appear below the bar; click `×` on one to remove it
  - Click "Clear all" — all filters reset

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/problems/ProblemTable.tsx
git commit -m "feat(ui): upgrade Problems tab with multi-select Difficulty, Patterns, and Comfort filters"
```

---

## Task 11: Push to Remote

- [ ] **Step 1: Final check**

```bash
git log --oneline -8
```

Verify all 10 commits from tasks 1–10 are present.

- [ ] **Step 2: Push**

```bash
git push origin main
```
