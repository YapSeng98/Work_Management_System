# Daily Brief

Paste your daily AI mailbox summary ("Daily Work Brief") and the app sorts it into
what's pending you, what you're waiting on others for, meetings and FYI — then
take the items you'll handle into **My Tasks**. Everything is stored in Supabase
behind a login.

## Setup

1. **Supabase project** — create one (region: Singapore), then run
   [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates the
   tables and Row Level Security so each user only sees their own rows.
2. **Your account** — Authentication → Users → *Add user* (email + password,
   auto-confirm). Then turn off *Allow new users to sign up*.
3. **Keys** — copy `.env.example` to `.env` and fill in the Project URL and the
   anon / publishable key (never the service_role / secret key).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## How it's put together

| Path | What it does |
| --- | --- |
| `src/App.tsx` | Auth gate: setup notice → sign-in → workspace |
| `src/Workspace.tsx` | Today / My Tasks / History tabs and all handlers |
| `src/lib/brief/` | Analyses a pasted brief: `jsonFormat` (structured block), `execFormat` (Executive Work Brief), `dailyFormat` (older Daily Work Brief) |
| `src/lib/db.ts` | All Supabase reads/writes (briefs, tasks, dismissed items, history) |
| `src/lib/supabase.ts` | Supabase client from `VITE_SUPABASE_*` env vars |
| `supabase/schema.sql` | Tables + RLS policies |
| `src/components/` | Paste card, brief view, My Tasks, history, login |

### How a brief is analysed

Paste a brief into the **Paste brief** box on the Today tab — it's analysed as soon
as it's pasted and saved to the `briefs` table. Three layouts are understood, tried in order:

1. **Structured JSON block** — most reliable. **Copy AI instructions** (on the paste
   box) copies a section to append to your AI prompt; the AI then ends its report with
   a JSON block listing every item once, with owner, urgency, risk, due date and Top-10 rank.
2. **Executive Work Brief** — the `=====`-divided report (Requires my response,
   Escalations, Open support incidents, UAT tracker, Customer follow-up, Risks, Top 10,
   Personal attention). Tables pasted as tab-separated text are reconstructed, and every
   mention of the same ticket (or the same thread, by subject keywords) is merged into one item.
3. **Daily Work Brief** — the earlier emoji-section layout.

Items are grouped as:

- **Pending you** — items where the next move is yours, ranked by priority tag,
  the brief's Top 5, and deadline wording ("EOD", "ASAP", "end of week").
- **Waiting on others** — items in "Waiting for Customer" or whose action is to chase / track sign-off.
- **Meetings** and **FYI** (no action; also anything listed under "Closed").

Each item gets a Do / Schedule / Delegate / Later quadrant. **Take** saves it to
`tasks` (My Tasks), **✕** saves it to `dismissed_items`, and both are logged to `history`.

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
