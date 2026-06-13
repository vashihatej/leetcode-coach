# LeetCode Coach — Design

**Date:** 2026-06-12
**Status:** Approved (design phase)

## Purpose

A personalized coding-interview coach that watches what the user does on LeetCode and
guides their *thinking* — never handing them solutions. It exists to fix one specific
problem: the user goes blank at the start of a problem, doesn't know how to begin, and
therefore peeks at solutions too early, which prevents real learning.

The coach must:
- Give the user a repeatable method so they are never blank.
- Engage with the user's *own* ideas (why they thought of it, why it fails, what to think
  instead) rather than just supplying correct answers.
- Build pattern-recognition instincts over time.
- Generate visual/animated explanations when the user struggles to understand a flow.
- Maintain long-term memory of how the user thinks, what they know, and what they don't,
  carried across every session.

## User Context

- Comfortable shipping real code: Chrome extensions (MV3), Vite, JavaScript, Node.
- Values working, production-quality code over speed.
- Has built Chrome extensions before — this architecture plays to existing strengths.

## Architecture

```
┌─────────────────┐     POST /event      ┌──────────────────────┐
│ Chrome Extension│ ───────────────────▶ │  Local Coach Server  │
│ (LeetCode page) │   problem, code,     │   (Node, localhost)  │
│                 │   run/submit results │                      │
└─────────────────┘                      │  ├─ writes session.md│◀── coach reads live
                                         │  ├─ writes SQLite DB │◀── history/mastery/SR
                                         │  └─ serves visualizer│
                                         └──────────┬───────────┘
                                                    │
                                              `coach` CLI  ◀── coach records outcomes
                                                            & queries the DB
        User ◀──── coaching (framework + hint ladder) ────  Coach (Claude Code, terminal)
```

**Data flow:** User opens a LeetCode problem → extension scrapes problem details + live code
+ run/submit results → server keeps `session.md` and the SQLite DB current → user talks to
the coach (Claude Code) in the terminal → coach reads `session.md` to see exactly what the
user is looking at, coaches them, and logs outcomes via the `coach` CLI into SQLite and
long-term memory.

**Chosen approach:** Local HTTP server + live files + SQLite (Approach A). Rejected:
Chrome Native Messaging (fiddly per-OS host manifest, no path to the future sidebar) and
markdown-only storage (spaced-repetition/mastery rollups get clumsy at scale).

**Coach UI:** v1 — the coach is Claude Code in the terminal; the extension streams to
`session.md` which the coach reads. v2 — upgrade to an injected sidebar chat on the
LeetCode page (server already running makes this a natural extension).

## Coaching Protocol

The defining behavior, encoded as a reusable skill so it runs identically every session.

### Layer 1 — The Framework (every problem, before any hint)

A fixed 5-step thinking ritual, delivered by *asking* not telling, so the user is never
blank:
1. **Restate** — inputs, outputs, constraints. (Counters "jumps to code" habit.)
2. **Examples & edges** — work one example by hand; name tricky edge cases.
3. **Brute force first** — the dumbest working solution + its complexity. (Always a start.)
4. **Find the bottleneck** — what's slow/wasteful in brute force; the bridge to optimal.
5. **Pattern match** — does the bottleneck smell like a known pattern?

### Layer 2 — The Hint Ladder (only when stuck, only on request)

Smallest nudge first, escalate only when the user asks again:
- Rung 1: point to which framework step they're stuck on.
- Rung 2: ask a leading question.
- Rung 3: name the *category* of technique (not which one).
- Rung 4: name the specific pattern.
- Rung 5: outline the approach in words (user still writes the code).
- **Never** write the solution code.

**Hard anti-spoiler rule:** never reveal the optimal approach or code unless the user has
climbed the ladder and explicitly says "just show me." Every hint rung used is logged as a
mastery signal.

### Idea-Engagement Loop (when the user proposes an approach)

1. **Mirror** — "you probably reached for this because you saw X." (Surfaces their thinking.)
2. **Stress-test by discovery** — hand them the edge case that breaks it; let them watch it
   break rather than being told.
3. **Pinpoint the exact fault** — name the precise wrong assumption and the reasoning that
   led there.
4. **Contrast the correct mental model** — the thought that should fire instead, and why.
5. **Reinforce the trigger** — "when you see [signal] → think [pattern]." The instinct seed.

### Instinct-Building (over time)

Every problem records *problem signal → correct pattern → did the user's instinct fire?*.
Periodic recognition-only drills: show a problem, user names what it "smells like," no
coding. Mastery map shows which triggers are becoming automatic vs. still missed.

## Data Model

### SQLite (`coach.db`) — structured, queryable facts & metrics

- **`problems`** — slug, title, difficulty, topic_tags, url. Cache of touched problems.
- **`attempts`** — problem_id, date, solved (bool), result_type (`brute`/`optimal`),
  hints_used (which rungs), time_spent, mistakes (text), final_approach (text). One row per
  sitting.
- **`patterns`** — name, mastery (`not_started`/`shaky`/`solid`), times_seen,
  times_instinct_fired, last_practiced.
- **`pattern_problems`** — join table linking problems ↔ patterns.
- **`review_queue`** — problem_id, due_date, interval, ease. Spaced repetition (SM-2-lite).

### Long-term memory (Claude auto-memory) — qualitative judgment

- **How the user thinks** — recurring habits, updated as evidence accrues.
- **Coaching calibration** — hint style that lands, analogies that clicked, current level.
- Read at the start of every session to resume seamlessly.

### Live state (`session.md`) — ephemeral, overwritten constantly

Current problem, the user's code right now, latest run/submit result. The coach's "eyes."

**Division of labor:** DB = facts & metrics; memory = judgment & personality; `session.md`
= live view.

## Components

1. **Chrome extension (MV3)** — content script on `leetcode.com/problems/*`: scrapes problem
   details, reads the Monaco editor code (debounced), captures run/submit results. Background
   worker POSTs events to the server. Popup shows "coach connected ✓".
2. **Coach server (Node)** — `localhost` HTTP server: receives events, writes `session.md`,
   upserts SQLite, serves visualizer pages. One command to start per session.
3. **`coach` CLI** — coach's interface to the DB: `coach status`, `coach log-attempt`,
   `coach review-due`, `coach mastery`. Keeps coach actions auditable by the user.
4. **Coaching skill** — encodes framework + hint ladder + idea-engagement loop.
5. **Visualizer** — generates self-contained animated HTML per concept (array cells lighting
   up, pointers sliding, DP table filling, tree/graph traversal, recursion stack), served by
   the server and opened in the browser, with play/step/reset controls.

## Scope

### v1 (MVP)
- Extension capturing problem + live code + run/submit results → server → `session.md` + SQLite.
- `coach` CLI for logging attempts and querying mastery/review.
- Coaching skill (framework + ladder + idea-engagement).
- Basic spaced repetition (`review-due`).
- Visualizer with on-demand animated HTML.

### v2+ (later)
- Injected sidebar chat UI on the LeetCode page (Coach UI upgrade).
- Polished instinct-recognition drill mode.
- Time/pause capture and proactive "you seem stuck" intervention.

### Explicitly out of scope (v1)
- Gating/blocking the LeetCode Solutions/Discuss tabs (user opted out; rely on coach quality).
- Time & pause tracking (not selected for v1).
- Any cloud component — everything runs locally.

## Open Questions / Risks

- **Monaco access:** reading the editor's live code from a content script may require reading
  the DOM or the Monaco model; needs real-DOM inspection (do not guess selectors).
- **Run/submit result capture:** LeetCode renders results dynamically; capturing reliably
  needs inspection of the actual result DOM/network responses.
- **Visualizer generation quality:** animations are generated per concept; needs a small
  reusable template/runtime so generation stays reliable.
