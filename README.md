# Daily Brief

A morning digest of your Outlook mail and calendar — meetings, flagged emails,
threads awaiting your reply — plus candidate tasks drafted from email that you
triage into Personal-Planning (Planner) with one click.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## How it's put together

| Path | What it does |
| --- | --- |
| `src/App.tsx` | Page shell: Today / History tabs, triage handlers |
| `src/api/digestClient.ts` | `fetchDigest()` — **stub**, returns mock data |
| `src/api/plannerClient.ts` | `createTaskInPlanner()` — **stub**, logs instead of POSTing |
| `src/lib/storage.ts` | Persists history and triage decisions in localStorage |
| `src/data/mock.ts` | Sample digest and seed history |
| `src/components/` | Cards, candidate task row, confirm dialog, history view |

### Triage behaviour

- **Add** opens the confirm dialog; on success the task goes to Planner and the
  candidate is hidden for good. If Planner fails, the dialog stays open with the error.
- **Snooze** hides the candidate until tomorrow.
- **Dismiss** hides it for good.

Every action is logged to History. Both survive a page reload.

## Not done yet

- **Real Planner integration** — needs the `pps/auth` contract and the `task`
  table schema from the Planner repo; replace the body of `createTaskInPlanner`.
- **Real Outlook data** — replace the body of `fetchDigest`; the data source
  (e.g. Microsoft Graph) is still to be decided.
- Due and Project options in the confirm dialog are hard-coded; they should come from Planner.
