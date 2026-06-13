# LeetCode Coach

Local coach backend (Stage 1). See `docs/superpowers/specs/` for the design.

## Run

```bash
npm install
npm test          # run the test suite
npm start         # start the coach server on http://localhost:8765
```

## CLI

```bash
node src/cli/coach.js status         # show current session.md
node src/cli/coach.js mastery        # show pattern mastery map
node src/cli/coach.js set-mastery --pattern "sliding window" --level solid
node src/cli/coach.js log-attempt --slug two-sum --solved --result optimal --hints 1,2 --approach "hash map"
```

Events arrive at `POST /event`; the server writes `session.md` (the coach's live view)
and persists to `coach.db`.
