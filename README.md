# Daily Brief

Paste your daily AI mailbox summary ("Daily Work Brief") and the app sorts it into
what's pending you, what you're waiting on others for, meetings and FYI — then
take the items you'll handle into **My Tasks**. Everything is stored in Supabase
behind a login.

## Setup

Daily Brief shares the **Planner app's Supabase project** (`rleqtargnhpsojfpegtf`):
you sign in with your Planner username and password, and **Take** creates a real
task in the Planner.

1. Run [`supabase/schema.sql`](supabase/schema.sql) once in that project's SQL Editor.
   It only adds `brief_*` tables (with Row Level Security); Planner tables are untouched.
   Planner sync works without it — until it's run, pasted briefs and history are kept
   in the browser instead.
2. `.env` holds the project URL and publishable key (public by design — the same key
   ships in the Planner's own bundle).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

### Data kept

Whenever a new brief is saved, briefs older than 60 days, dismissed items older than
90 days and history older than 180 days are deleted, and pasting the same brief twice
keeps one copy. **History → Clear all data** wipes briefs, dismissed items and history
(and, if you confirm, the tasks Daily Brief created in the Planner).

### How it talks to the Planner

- Tasks are written **only through the Planner's `sync_push()` RPC** — the path its own
  devices use — so field edit times and revisions stay consistent. New tasks send only
  the fields they fill (title, notes, state, priority, due); ticking done sends `state`;
  delete is the Planner's soft delete (`deleted`). See `src/lib/planner.ts`.
- No link table: a task's id is derived from the account + brief item (the Planner's own
  `uuidFrom` pattern), so taking an item again targets the same task, and its notes end
  with a `— Daily Brief · <Quadrant> · <brief>` line. **Keep that line's start stable** —
  the Planner uses it to badge these tasks. My Tasks lists Planner tasks carrying it, so
  titles, due dates and done state edited in the Planner show up here, and tasks ticked
  done anywhere close automatically ("Closed today").
- Live updates: Realtime on the `brief_*` tables plus the Planner's `sync_signals`
  (bumped on every task change from any device).

## How it's put together

| Path | What it does |
| --- | --- |
| `src/App.tsx` | Auth gate: setup notice → sign-in → workspace |
| `src/Workspace.tsx` | Today / My Tasks / History tabs and all handlers |
| `src/lib/brief/` | Analyses a pasted brief: `jsonFormat` (structured block), `ownershipFormat` (Section A/B/C report), `execFormat` (Executive Work Brief), `dailyFormat` (older Daily Work Brief) |
| `src/lib/db.ts` | All Supabase reads/writes (brief_* tables, Planner tasks via sync_push) |
| `src/lib/planner.ts` | Planner bridge: username login, priority / due / notes mapping, push items |
| `src/lib/supabase.ts` | Supabase client from `VITE_SUPABASE_*` env vars |
| `supabase/schema.sql` | `brief_*` tables + RLS, for the Planner's Supabase project |
| `src/components/` | Paste card, brief view, My Tasks, history, login |

### How a brief is analysed

Paste a brief into the **Paste brief** box on the Today tab — it's analysed as soon
as it's pasted and saved to the `briefs` table. Three layouts are understood, tried in order:

1. **Structured JSON block** — most reliable. **Copy AI instructions** (on the paste
   box) copies a section to append to your AI prompt; the AI then ends its report with
   a JSON block listing every item once, with owner, urgency, risk, due date, Top-10 rank
   and a suggested reply.
2. **Ownership report** — Section A (my actions only), Section B (team actions),
   Section C (waiting on customer), Escalations, Aging items, Top 10, Executive summary.
   The brief's own split decides ownership: A → *Pending you*, B → *Owned by your team*
   (shown separately, not your task), C → *Waiting on others* (or an "awaiting customer"
   badge when A/B also own it). Your name is read from the brief ("Required Action From …")
   to tell your Top-10 rows from colleagues'.
3. **Executive Work Brief** — the earlier `=====`-divided report (Requires my response,
   Escalations, Open support incidents, UAT tracker, Customer follow-up, Risks, Top 10,
   Personal attention). Tables pasted as tab-separated text are reconstructed, and every
   mention of the same ticket (or the same thread, by subject keywords) is merged into one item.
4. **Daily Work Brief** — the earlier emoji-section layout.

Items are grouped as:

- **Pending you** — items where the next move is yours, ranked by priority tag,
  the brief's Top 5, and deadline wording ("EOD", "ASAP", "end of week").
- **Waiting on others** — items in "Waiting for Customer" or whose action is to chase / track sign-off.
- **Meetings** and **FYI** (no action; also anything listed under "Closed").

Each item gets a Do / Schedule / Delegate / Later quadrant. **Take** creates a Planner
task (priority from urgency, due date from the brief, details in its notes) and links it;
**✕** saves to `brief_dismissed`; both are logged to `brief_history`.

### Built on your stored history

- **Live** — the app subscribes to Supabase Realtime and refetches whenever any of
  the four tables changes, so other tabs and devices stay in sync without a refresh.
- **Pending since** — an item whose ticket number appeared in an earlier brief shows
  the date it was first seen.
- **Already taken** — an item counts as taken if an open task came from the same item
  *or shares a ticket number*, so a reworded follow-up in tomorrow's brief isn't taken twice.
  A completed task whose item comes back can be reopened with **Take again**.
- **History tab** — stats for the last 7 days, every past brief (click **View** to
  reopen it on Today) and the full activity log, all read from the database.
