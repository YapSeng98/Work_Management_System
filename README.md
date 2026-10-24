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
| `src/App.tsx` | Page shell: Today / My Tasks / History tabs, triage handlers |
| `src/api/digestClient.ts` | `fetchDigest()` — **stub**, returns mock data |
| `src/api/plannerClient.ts` | `createTaskInPlanner()` — **stub**, logs instead of POSTing |
| `src/lib/briefParser.ts` | Analyses a pasted Daily Work Brief into ranked items |
| `src/lib/storage.ts` | Persists history, triage, pasted brief and My Tasks in localStorage |
| `src/data/mock.ts` | Sample digest and seed history |
| `src/components/` | Cards, candidate task row, confirm dialog, history view |

### Paste a brief (Today tab)

Paste a "Daily Work Brief" (AI mailbox summary) into the **Paste brief** box — it is
analysed as soon as it's pasted, entirely in the browser (`src/lib/briefParser.ts`):

- **Pending you** — items where the next move is yours, ranked by priority tag,
  the brief's Top 5, and deadline wording ("EOD", "ASAP", "end of week").
- **Waiting on others** — items in "Waiting for Customer" or whose action is to chase / track sign-off.
- **Meetings** and **FYI** (no action; also anything listed under "Closed").

Each item gets a Do / Schedule / Delegate / Later quadrant. **Take** moves it to
**My Tasks**, where it can be ticked off. The pasted text and tasks are kept in
localStorage only.

### Triage behaviour (sample data)

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
