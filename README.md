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
| `src/lib/briefParser.ts` | Analyses a pasted Daily Work Brief into ranked items |
| `src/lib/db.ts` | All Supabase reads/writes (briefs, tasks, dismissed items, history) |
| `src/lib/supabase.ts` | Supabase client from `VITE_SUPABASE_*` env vars |
| `supabase/schema.sql` | Tables + RLS policies |
| `src/components/` | Paste card, brief view, My Tasks, history, login |

### How a brief is analysed

Paste a brief into the **Paste brief** box on the Today tab — it's analysed as soon
as it's pasted and saved to the `briefs` table:

- **Pending you** — items where the next move is yours, ranked by priority tag,
  the brief's Top 5, and deadline wording ("EOD", "ASAP", "end of week").
- **Waiting on others** — items in "Waiting for Customer" or whose action is to chase / track sign-off.
- **Meetings** and **FYI** (no action; also anything listed under "Closed").

Each item gets a Do / Schedule / Delegate / Later quadrant. **Take** saves it to
`tasks` (My Tasks), **✕** saves it to `dismissed_items`, and both are logged to `history`.
