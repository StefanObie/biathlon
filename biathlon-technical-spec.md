# Biathlon Race-Day System — Technical Specification

**v1.1 · 29 August 2026 · Internal / developer reference**
Stack: TypeScript · Next.js (App Router) on Vercel · Supabase (Postgres/Auth/Realtime/RLS, declarative schemas + CLI migrations) · Dexie · `@react-pdf/renderer` · shadcn/ui · Husky + Conventional Commits · ESLint/Prettier.

**Project bootstrap:** `npx create-next-app@latest my-app -e with-supabase` — the official Next.js + Supabase starter (App Router, `@supabase/ssr` cookie-based auth already wired, `.env.local.example` included). Tooling in §5.12–§5.15 is layered on top of that starter, not built from a bare `create-next-app`.

---

## 1. System summary

Two independent capture streams, joined by position:

- **Position stream** — at the results table, one marshal scans each athlete's QR bib in finish order, with a Skip button for gaps. The position card itself is not scanned (§4.3).
- **Time stream** — at the finish line, a timekeeper presses one button per finisher, with vibration feedback and a "missed one" placeholder button.
  A reconciliation screen joins the two streams by position within a heat, flags mismatches, and lets an official correct them before publishing. Swim results are parsed from the Time Drops export, merged per athlete, and exported as XML.

**Core invariant: raw captures are never edited or deleted.** Corrections are overlays on immutable capture rows (`time_capture`, `position_capture`), so any result traces back to what was actually recorded.

**Equipment: two phones, a printer. No router, no venue server, no dedicated hardware.** Fully online — phones on mobile data talking to Vercel/Supabase over HTTPS.

---

## 2. Data findings from real source files

Validated against `2__2026-08-25-GNB-League-1-Session-1-results.txt` (Time Drops export) and a 90-row entry sample.

**Finding 1 — the swim file truncates athlete numbers.** The name column is fixed at 30 characters with the athlete number at the end:

```
Athlete Aaaaaaa Bbbb (AFL) (81      1:13.31
Athlete Ccccc Dddd (AFL) (5861      39.39
Athlete Eeeee Ffffff (AFL) (1000      51.88
Athlete Ggggggg Hhhhh (AFL) (8      43.42
Athlete Iiiii Jjjjjjjjjjjjjjj (6746      38.81
```

Seven swimmers in the sample file have **no athlete number at all** (`Athlete J`, `Athlete K`, `Athlete L`, `Athlete M`, `Athlete N`, `Athlete O`, `Athlete P (AFL)`) — ~12% of one session unresolvable by athlete number alone.

**Finding 2 — names are not unique.** `Athlete Q` appears as both athlete 6209 and 8125, in adjacent heats of the same event. Name matching must never be a trusted automatic fallback.

**Finding 3 — (swim heat, lane) is a reliable resolution key.** The entry export supplies both. Match on (heat, lane) as primary, athlete number as confirmation.

**Finding 4 — `mm:SS.ss` is a safe canonical time format.** Every time in the sample file normalises cleanly (`59.27` → `00:59.27`, `1:13.22` → `01:13.22`, `2:26.60` → `02:26.60`). Zero-padded minutes mean **lexicographic sort equals chronological sort** — verified across all 83 distinct times in the file. The PDF's base times normalise identically (`2 min 47` → `02:47.00`), so one format serves capture, storage, points arithmetic, and export.

**Finding 5 — cross-validated against the real 90-row entry sample.** Every one of the twelve previously-unresolvable swimmers resolves correctly on (swim heat, lane):

- `Athlete Aaaaaaa Bbbb (AFL) (81` (truncated) → athlete **8124** ✓
- `Athlete P (AFL)`, `Athlete M`, `Athlete N`, `Athlete O` (no number at all) → all resolve via (heat, lane) ✓
  This also confirms **`Swim Heat` in the entry export uses the same numbering as the Time Drops file — sequential across events, no per-event restart, no offset.** Settled by data; no further confirmation needed.

**Finding 6 — the points formula verifies against the PDF's worked example**, with one exception:

| Run time | Computed | PDF          | Swim time | Computed | PDF       |
| -------- | -------- | ------------ | --------- | -------- | --------- |
| 02:29.05 | 1035.90  | 1035.90 ✓    | 01:01.03  | 1059.85  | 1059.85 ✓ |
| 02:45.00 | 1004.00  | 1004.00 ✓    | 01:13.00  | 1000.00  | 1000.00 ✓ |
| 02:47.00 | 1000.00  | 1000.00 ✓    | 01:19.51  | 967.45   | 967.45 ✓  |
| 02:48.52 | 996.96   | **988.96 ✗** | 01:25.12  | 939.40   | 939.40 ✓  |

Formula: `1000 + (base − actual) × pts_per_sec`, run = 2 pts/sec, swim = 5 pts/sec, on fractional seconds. Row 4 is internally consistent with 988.96 (the PDF's combined total uses that figure), so the source PDF has a typo in either the time or the points value — flag to whoever maintains the table (§9, item 2).

**Finding 7 — scale confirmed against the entry sample.** Max 1,000 athletes/meet, one session/meet, max 20/heat. The 90-row sample: run heats sized 7–12, swim heats sized 2–6, no duplicate athlete numbers, no (heat, lane) clashes. At this volume Postgres needs no special indexing or partitioning — a plain composite index on `(meet_id, run_heat)` and `(meet_id, swim_heat, swim_lane)` is sufficient.

**Finding 8 — age bands are gender-independent.** Cross-checked the PDF: year-born ranges are identical across Girls/Ladies and Boys/Men; only run/swim times and bonus rates differ by gender. Relevant to the `points_table` design in §5.

---

## 3. Topology

```
   ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
   │ Timer phone │   │ Table phone │   │ Laptop /     │
   │ (finish)    │   │ (scanning)  │   │ tablet       │  ← optional, existing
   └──────┬──────┘   └──────┬──────┘   └──────┬───────┘
          │  mobile data    │                 │
          └─────────────────┴─────────────────┘
                            │
                ┌───────────▼────────────┐
                │  Vercel (Next.js)      │
                │  Supabase (Postgres)   │
                └────────────────────────┘
```

Fully online, no local network. Every capture still writes to phone storage first and syncs in the background — this is **not** for offline resilience (there's no offline requirement), it's for response latency: a button press must never wait on a network round trip (§6.6).

Browsers block camera access (`getUserMedia`) on insecure origins — Vercel's automatic HTTPS avoids self-signed-certificate warnings on volunteers' phones, which self-hosting would not.

Public results have nowhere else to live, so they're a page in this same app (Phase 4), reading published heats via Supabase RLS — no separate API or hosting needed.

---

## 4. Race-day flow, implementation detail

### 4.1 Pre-meet

Import entry TSV → generate PDFs (not browser print — see §5.6):

- **Athlete bibs:** QR payload `BCL-{athleteNo}` (short prefix keeps modules large and scan-fast, and lets the scanner reject foreign QR codes), athlete number in large human-readable digits, name, run heat, swim heat, swim lane.
- **Position cards:** reusable, printed once, numbered 1–20. **Not scanned** — see §4.3. Matte stock; glare is the primary cause of outdoor scan failure. QR ECC level Q, ≥30mm square, quiet zone maintained.

### 4.2 Finish line → table

Existing chute process, unchanged. Athletes carry a position card from the line to the table.

### 4.3 Table capture — position-tracked, athlete-only scan

The app tracks position; the operator scans only the athlete (scanning both cards was assessed and rejected — not worth the per-athlete cost for a single sequential operator).

UI: large `POSITION {n}` display. Scan → resolves athlete → position auto-increments. **Skip** button advances position and records an explicit gap (no scan attempted). Last three scans shown with **Undo** on the most recent.

The (unscanned) position card still functions as a visual cross-check — the number on the card should match the number on screen; the marshal can catch a mismatch and Skip/correct before it reaches reconciliation.

**Scan performance — three implementation requirements, in priority order:**

1. Keep the camera stream alive between scans. Do not tear down and reinitialise `getUserMedia`/decoder per scan — this is the dominant cost (1–2s) in naive implementations.
2. Continuous scan mode: decode → confirm (sound + vibration) → continue. No tap-to-confirm step.
3. Duplicate suppression: ignore repeat reads of the same code within a short window, so a card lingering in frame doesn't double-register.
   Decoder: native `BarcodeDetector` where available (Chrome/Android), `@zxing/browser` fallback (iOS Safari) — see §5.9.

Manual fallback: type the athlete number (printed large on the bib) if a code won't scan.

### 4.4 Finish-line timer

One large button per finisher. Implementation requirements:

- `navigator.vibrate(30)` on every press — tactile confirmation without requiring the operator to look at the screen. (Hardware volume-key capture was investigated and ruled out — browsers deliberately block it; see §5.4.)
- Live running count of presses, for field sanity-check.
- Last three times visible for immediate double-press detection/undo.
- **"Missed one" placeholder button** — inserts `is_placeholder = true` at the correct slot when the operator knows in the moment they fumbled a press. This is the single highest-value control on this screen: without it, a missed press silently shifts every subsequent athlete in the heat by one position, with no positional signal for where the error began.
  UX principle applying to both this screen and §4.3: one action per screen, no visible configuration. Target: usable by a substitute operator with under two minutes of explanation.

### 4.5 Reconciliation

| Pos | Time     | Athlete (scanned) | Status                     |
| --- | -------- | ----------------- | -------------------------- |
| 1   | 01:47.03 | 7409 Athlete R    | OK                         |
| 2   | 01:49.55 | 8081 Athlete S    | OK                         |
| 3   | 01:52.10 | —                 | ⚠ skipped at table         |
| 4   | —        | 8207 Athlete T    | ⚠ placeholder — enter time |

**Operations:** insert/remove a gap in either stream; soft-delete with reason; reassign athlete by number or name search; manually add an athlete who ran outside their assigned heat; edit time as `mm:SS.ss`; mark DNS/DNF/DQ.

**Automatic checks:** captured count vs roster count for heat; athlete not on this heat's roster; athlete already has a time in another heat; time outside ~60–250% of the age group's 1,000-point base (implausibility flag, not a block).

**Publish gate:** a heat is not visible for export or public display until an official confirms it. Reopening a published heat requires a reason, logged to `audit_log`.

### 4.6 Swim import parser

| File pattern                                                    | Handling                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Event #2 Heat 3 Race 3 ... (Start: 17:31:53)`                  | Parse event/heat/race/distance/stroke from header                     |
| `Open 50 SC Meter Freestyle`                                    | Extract distance; cross-check against `points_table.swim_distance_m`  |
| Athlete number in parentheses                                   | Confirmation only, not the lookup key                                 |
| Truncated/missing number                                        | Resolve via **(swim_heat, lane) → entry**                             |
| `(AFL)` marker                                                  | Strip before any name-matching fallback                               |
| `NS`                                                            | Did not start — no time row                                           |
| Time `0.00`                                                     | Never imported as a time; recorded as no-result                       |
| `(REVISED FROM EARLIER - USE WITH CAUTION)`                     | Later block supersedes earlier; both retained; row flagged for review |
| Disagreeing backup columns (e.g. `2:26.60 / 1:38.43 / 3:14.77`) | Use official TIME column; flag row                                    |
| False-start / console-noise lines                               | Ignore                                                                |

All times normalised to `mm:SS.ss` on import.

**Resolution ladder (strict order, never skip ahead):**

1. Exact athlete number match
2. (swim_heat, lane) → entry roster
3. Name match, **only if unambiguous** (the `Athlete Q` collision means step 3 must never auto-accept)
4. Human exception queue, source line shown verbatim

### 4.7 XML export

Passthrough — no formatting logic needed since times are already canonical:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<results>
  <result>
    <athleteNo>7409</athleteNo>
    <swimtime>00:56.12</swimtime>
    <runtime>01:47.03</runtime>
    <athleteName>Firstname</athleteName>
    <athleteSurname>Lastname</athleteSurname>
  </result>
</results>
```

**UTF-8 mandatory** — real data contains accented characters such as `é` and `ü`. Use `xmlbuilder2`, never string templates (§5.10). XML element names (`athleteName`/`athleteSurname`) differ from DB column names (`first_name`/`last_name`) — mapping lives only in the serialiser.

---

## 5. Tech stack — decisions and reasoning

### 5.1 TypeScript

Shared types across the device/server boundary for capture payloads. The domain logic (time arithmetic, index matching) fails silently rather than throwing when types are loose — `undefined` slipping through produces a _plausible wrong result_, not a crash. That's the failure mode worth paying for with strict typing.

### 5.2 Next.js (App Router) on Vercel

Chosen for existing familiarity (another active project already on this stack) over any framework-neutral comparison.

- **Route handlers** for the capture sync endpoint and XML export, alongside UI in one repo/deploy.
- **Server Components** for reconciliation/admin screens, keeping heavy table rendering off the phone bundle.
- **Runtime constraint:** the PDF generation route (§5.6) needs the Node.js runtime — `@react-pdf/renderer` doesn't run on Edge. As of Next.js 16.3 the Edge Runtime is deprecated and Node.js is the only/default runtime, so no `export const runtime` is written (or needed) any more; under Cache Components (§5.16) that export is now a build error. If a future Next.js version reintroduces a runtime choice, re-add it explicitly for this route.
- **Cache Components note:** this project has `cacheComponents: true` set from the starter. Every Server Component that reads Supabase/auth data is pushed down into a `<Suspense>`-wrapped child so routes partially prerender instead of falling back fully dynamic — the one exception is the auth-gating layout (`app/meets/layout.tsx`), which opts out via `export const instant = false` since its redirect decision has to resolve before anything below it can render (the documented case for that escape hatch).

### 5.3 Supabase — Postgres, Auth, Realtime, RLS

- Managed Postgres — no DB administration; genuinely relational data benefits from real FKs/constraints.
- Realtime subscriptions — reconciliation screen updates live with no hand-rolled WebSocket layer.
- RLS — public results read published heats directly and safely, no separate public API.
- Auth — operator sign-in, not hand-rolled.
  Free tier covers this scale comfortably (hundreds of rows/meet). Nearest region to Gauteng ≈ Frankfurt (~180–250ms) — irrelevant since no capture action blocks on a round trip.

### 5.4 Volume button — investigated, ruled out

Browsers deliberately don't expose the hardware volume rocker to web pages on Android or iOS (confirmed: Apple's developer forum states this is blocked by design, "to avoid changing the expected behaviour of buttons"). No PWA-level workaround exists; only a full native app can intercept it, which isn't worth the added build/distribution complexity here.

**Decision:** on-screen button + `navigator.vibrate()` (§4.4), by default.
**Fallback upgrade if needed:** a Bluetooth/wired presentation clicker pairs as a standard keyboard — a normal `keydown` listener picks it up like any other keyboard device, no native wrapper required. ~R150–250, keep in the kit as an optional upgrade if the on-screen button proves unreliable in bright sun or with sweaty/gloved hands.

### 5.5 Supabase CLI — declarative schemas and migrations

**What it is.** Schema declared as plain SQL files under `supabase/schemas/` (e.g. `core.sql`); the CLI diffs the declared state against the local Postgres shadow database and generates a timestamped migration file, rather than hand-writing incremental `ALTER TABLE` statements.

```sql
create table athlete (
  athlete_no integer primary key,
  first_name text not null,
  last_name  text not null,
  gender     gender not null   -- 'M' | 'F'
);

alter table athlete enable row level security;
```

Queries go through `supabase-js` directly — no separate query-builder layer between the app and Postgres.

Workflow:

```
npm run db:diff     # supabase db diff -f <name> — diffs schemas/ against local DB, writes migration SQL
npm run db:migrate  # supabase migration up — applies pending migrations
```

Generated SQL is checked into git under `supabase/migrations/`, reviewable before running — important because `points_table` is versioned by season; a 2028 update should be a reviewed migration, not a dashboard edit with no record.

**One tool, one migration history:** schema, migrations, and RLS policies all live in the same `supabase/` tree and are tracked in the single `supabase_migrations.schema_migrations` table — no second migration-tracking table to drift out of sync with (§5.15 covers the local-first CLI workflow this sits inside).

**Trade-off vs a TS schema layer (e.g. Drizzle, considered and dropped):** no compile-time query type-checking against the schema — types come from `supabase-js`'s generated types instead. Acceptable here since RLS policies and schema live together either way, and the query surface is small enough that this isn't the main correctness risk (§5.1's silent-wrongness risk is in the domain logic, not the data-access layer).

### 5.6 `@react-pdf/renderer` for bibs and position cards

Browser print CSS is unreliable — "shrink to fit" can silently rescale a 30mm QR code to 26mm depending on the volunteer's print dialog, an invisible failure mode. Fixed-dimension PDF prints identically everywhere.

QR codes stay vector — extract path data from the `qrcode` package and render via SVG primitives:

```tsx
const d = QRCode.toString(`BCL-${athleteNo}`, {
  type: "svg",
  errorCorrectionLevel: "Q",
});
<Svg width={85} height={85} viewBox="0 0 33 33">
  <Path d={pathData} fill="black" />
</Svg>;
```

Crisp module edges at any print size — soft edges cost decode attempts on every scan of the day. Page dimensions set explicitly in mm. Built-in Helvetica covers Latin-1, so `é`/`ü` render without a custom font. Node runtime only (§5.2).

### 5.7 PWA with local write queue (Dexie / IndexedDB)

Every capture writes to the phone first, syncs after. Two reasons, primarily the first:

1. **Latency, not connectivity.** A time-press must never show a spinner — write local, sync async.
2. Mobile data at outdoor venues over a multi-hour meet isn't perfectly reliable; a dropped packet mid-heat must not lose a capture.
   PWA install gives a home-screen icon/full-screen mode.

_Rejected:_ `localStorage` (synchronous, blocks main thread, 5MB cap, no querying). Raw IndexedDB (callback-heavy, common source of subtle bugs). Native app (store distribution/per-platform builds for no capability gain — `getUserMedia` already gives full camera access).

### 5.8 ULIDs for capture record IDs

Client must generate the ID before the server sees the row (write-then-sync requires this). ULIDs sort by creation time (natural index ordering) and provide idempotency — a resend after a flaky connection can't create a duplicate.

_Rejected:_ server autoincrement (impossible client-side); UUIDv4 (random ordering fragments the index for no benefit here).

### 5.9 Native `BarcodeDetector`, `@zxing/browser` fallback

`BarcodeDetector` — native, fast, low-power, Chrome/Android. Not implemented in iOS Safari, hence the WASM fallback. ~30-line abstraction switches between them.

_Rejected:_ `html5-qrcode` — wraps zxing anyway, ships an opinionated UI awkward to strip to a bare continuous-scan view.

### 5.10 `xmlbuilder2` for export

Correct escaping/encoding declaration. String-templated XML is where `é`/`ü`/`&` in real names become a malformed file SA Biathlon rejects.

### 5.11 Vitest + Playwright

Swim parser and position/time matching are the **silent-wrongness** risk surfaces — bugs there produce a believable wrong result, not a crash. Pin tests to the real sample files as fixtures, including the twelve problem rows from §2.

Playwright covers capture-flow interaction failures: double-press, backgrounded tab, mid-heat signal loss, camera permission denial.

### 5.12 shadcn/ui + Tailwind

Component source is copied into the repo (`components/ui/`), not installed as an opaque dependency — matches the project's general preference for owning code over black-box packages, and matters here specifically because the capture screens (§4.3, §4.4) need non-standard touch-target sizing (large buttons, high-contrast outdoor-readable states) that's easier to hand-edit than override via a theming API.

```
npx shadcn@latest init
npx shadcn@latest add button card dialog table badge toast
```

Use for reconciliation-table chrome, dialogs, and admin/status screens (§4.5). The two field-capture screens (§4.3 timer, §4.4 scanner) stay deliberately minimal — one oversized primary control, no component-library chrome competing for tap area — so pull in only `Button`/`Toast` there, not the full kit.

### 5.13 Linting, formatting, type checking

- **ESLint** — `eslint-config-next` (ships with the starter) plus `@typescript-eslint/strict`. Given §5.1's rationale (loose types → plausible wrong results, not crashes), lint config should not loosen `strict` mode.
- **Prettier** — formatting only, no stylistic ESLint rules fighting it; `eslint-config-prettier` disables the overlap.
- **`tsc --noEmit`** in CI — Next.js's build-time type check is a good local signal but shouldn't be the only gate; run it explicitly in the pipeline.

```
npm i -D eslint-config-prettier prettier
```

### 5.14 Husky + Conventional Commits

Pre-commit/pre-push hooks and a commit-message convention, matching how the domain is structured through the rest of this spec — invariant-preserving small commits (capture immutability, §1) over large mixed diffs.

```
npm i -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

- **`.husky/pre-commit`** → `lint-staged` (ESLint --fix + Prettier on staged files only — fast, doesn't lint the whole repo every commit).
- **`.husky/commit-msg`** → `commitlint --edit "$1"`, enforcing `@commitlint/config-conventional` (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, with scope, e.g. `feat(reconciliation): add gap-insert action`).
- Commit types should map to this doc's phases where practical (`feat(phase-1-timer): ...`) so `git log` reads as a phase-ordered changelog, useful given the shadow-run acceptance gate in §10.

`lint-staged` config (in `package.json` or `lint-staged.config.js`):

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

### 5.15 Supabase — official skills, agent guidance, best practices

- Install the official Supabase agent skill set for schema/RLS/auth guidance during development: `npx skills add supabase/agent-skills` (per Supabase's own AI-skills docs). Load it whenever writing migrations, RLS policies, or Auth flows in this project — the skill's guidance takes precedence over ad hoc SQL, since RLS is the only thing standing between `entry`/`athlete` tables and the public results page (§3, §6.1).
- **Local-first workflow:** use the Supabase CLI (`supabase start`, `supabase migration new`, `supabase db diff`) against a local stack before touching the remote project. Matches the CLI's own guidance and avoids the class of mistake this project can least afford — an RLS policy that's wrong in production on a public-facing results page.
- **`@supabase/ssr`**, not the deprecated auth-helpers package, for cookie-based session handling in Server Components/Route Handlers — this is what the `with-supabase` starter (bootstrap line, top of doc) already wires up; don't hand-roll an alternative.
- **Migration ownership stays entirely with the Supabase CLI** (§5.5) — schema, RLS policies, and migrations all live in `supabase/` and apply through the same tooling, so there's only one migration history to keep consistent.
- Re-run the security-advisor check (CLI or dashboard) after any schema change that touches a table exposed to the public results page — RLS gaps are the primary risk there.

### 5.16 Next.js / App Router best practices (project-specific application)

- **Server Components by default**; `'use client'` only on the two capture screens and any component using browser APIs (`getUserMedia`, `navigator.vibrate`, Dexie) — keeps the phone bundle small, per §5.2's existing rationale.
- **Server Actions** for reconciliation mutations (§4.5 operations: insert/remove gap, reassign athlete, edit time) instead of hand-rolled route handlers where no external caller needs the endpoint — reduces client-side fetch boilerplate and keeps mutation + revalidation co-located.
- **`revalidatePath`/`revalidateTag`** on publish (§4.5 publish gate) so the public results page (§3) reflects a newly published heat without a manual refresh, consistent with the Realtime-driven reconciliation screen (§5.3).
- Route Handlers reserved for what actually needs them: the capture sync endpoint (external device → server, §6.6) and XML export (§4.7) — both are non-HTML responses to non-browser-navigation calls, the correct use case for a Route Handler over a Server Action.
- Environment variables validated at startup (`@t3-oss/env-nextjs` or equivalent zod-based check) — misconfigured Supabase keys should fail the build/boot, not fail silently at first request on race day.

---

## 6. Data model

### 6.1 Core tables

No date of birth in the source data — age group is taken directly from SA Biathlon's classification per athlete, not derived. No separate `age_group` reference table — the age band is columns on `points_table` directly, and `entry` just carries the code. Verified (§2, Finding 8) that year-born bands are identical across gender, so this duplication is small and static.

```sql
create type gender as enum ('M','F');

athlete      (athlete_no pk, first_name, last_name, gender)

meet         (id pk, name, meet_date, season)

entry        (meet_id fk, athlete_no fk,
              run_heat, swim_heat, swim_lane,
              age_group_code,                 -- from SA Biathlon classification, imported directly
              primary key (meet_id, athlete_no))

points_table (effective_from, gender, age_group_code,
              age_group_label, sort_order, age_from, age_to,
              run_distance_m, run_base_time, run_points_per_second,
              swim_distance_m, swim_base_time, swim_points_per_second,
              bonus_points_per_year,           -- stored, not applied — see 6.3
              primary key (effective_from, gender, age_group_code))
```

**Resolution:** `entry.age_group_code` set on import (`U/09 GIRLS` → `U09`). Points lookup joins `athlete.gender` + `entry.age_group_code` + the season's `points_table` row → label, age bounds, both distances, both base times, bonus rate, in one row.

**Trade-off accepted:** `entry.age_group_code` cannot be a real FK — `points_table`'s key includes `effective_from`/`gender`, which `entry` doesn't have. Validated at **import time** instead: check against distinct codes present in the season's `points_table`, flag anything unrecognised (same pattern as the swim exception queue, §4.6).

### 6.2 Scale and heat identity

Confirmed limits: ≤1,000 athletes/meet, one session/meet, ≤20/heat (validated against real 90-row sample, §2 Finding 7). Because there's only ever one session per meet, `run_heat`/`swim_heat` stay as plain integers on `entry` — no separate `session` or `heat` table. `heat_id` referenced below is the pair `(meet_id, run_heat)`.

### 6.3 Masters bonus points — deferred, not implemented

The PDF's "bonus points per year over base" needs exact age (birth year), unavailable in the source data. Points engine (Phase 4) computes run + swim components only, **omits the bonus term**, and both the results screen and PDF export carry: _"Points shown exclude age-related bonus points and are not official SA Biathlon points."_ Affects Seniors (28+) upward only. `bonus_points_per_year` remains in `points_table`, unused, so nothing needs restructuring if birth year becomes available later.

### 6.4 Time storage

```sql
run_time     text check (run_time ~ '^\d{2}:\d{2}\.\d{2}$'),
run_time_cs  integer generated always as (
               substring(run_time from 1 for 2)::int * 6000
             + substring(run_time from 4 for 2)::int * 100
             + substring(run_time from 7 for 2)::int
             ) stored
```

Text column is source of truth (exports verbatim); generated column gives exact integer centiseconds for arithmetic/ranking, maintained by Postgres so it cannot drift. `check` constraint rejects malformed times at the DB boundary.

**Precision note:** centisecond storage matches the swim system exactly, but is finer than hand-timing accuracy (~200ms human variance on a button press). Immaterial for points (0.01s ≈ 0.02 points) but means hundredths-decided run placings aren't meaningful — needs an explicit tie rule (§9, item 3).

### 6.5 Capture and result tables

```sql
-- immutable capture
time_capture     (id ulid pk, heat_id, seq, elapsed_time, is_placeholder,
                  device_id, captured_at, voided, void_reason)
position_capture (id ulid pk, heat_id, position, athlete_no,
                  device_id, scanned_at, voided, void_reason)

-- derived, with overrides
run_result       (meet_id, athlete_no, heat_id, run_time, run_time_cs,
                  status, source, overridden_by, override_reason)
swim_result      (meet_id, athlete_no, event_no, heat, lane, distance_m,
                  swim_time, swim_time_cs, place, status,
                  source_line, needs_review)

audit_log        (at, actor, entity, action, before, after, reason)
```

`position_capture.position` assigned by the app, increments on scan or Skip. `is_placeholder` is the "missed one" flag (§4.4).

### 6.6 Why writes never block on network (cross-ref)

Justifies §5.7/§3: `time_capture`/`position_capture` rows are constructed and written to Dexie synchronously on button press/scan, then pushed to Supabase async with the pre-generated ULID as the idempotency key. UI never awaits the network call.

---

## 7. Phasing (developer-facing)

| Phase | Deliverable                                                                                                                                                                | Est.    | Notes                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| **0** | Project bootstrap (`create-next-app -e with-supabase`), tooling (shadcn/ui, ESLint/Prettier, Husky + commitlint), entry import, roster, bib + position card PDF generation | 2–3 wks | Standalone deployable, zero race-day risk. Tooling setup (§5.12–§5.16) front-loaded here so every later phase inherits it. |
| **1** | Timer app, scanning app, reconciliation, manual edit                                                                                                                       | 3–4 wks | Shadow-run against paper process for one full event before relying on it                                                   |
| **2** | Swim import, exception queue, merge, XML export                                                                                                                            | 2 wks   | Parser built against real files as fixtures (§2, §4.6)                                                                     |
| **3** | Hardening: audit log, error monitoring, dry run                                                                                                                            | 1 wk    |                                                                                                                            |
| **4** | Points engine + public results (in-app)                                                                                                                                    | later   | Deferred; bonus points out of scope (§6.3); schema ready                                                                   |

---

## 8. Fallback / degraded operation

- Paper capture sheets in every heat bag — any heat enterable by hand.
- Power banks for both phones (camera is the dominant battery draw; scanning phone won't survive a full meet unaided).
- Backup stopwatch at the finish line.
- Position cards double as a paper record of finish order.

---

## 9. Open technical questions

1. **XML contract.** XSD or documented format from SA Biathlon? Does `mm:SS.ss` match expectation? Behaviour for an athlete with only one of the two times — empty element, omitted element, or sentinel? _Blocks Phase 2._
2. **PDF example discrepancy.** `02:48.52` → `988.96` in the source PDF; formula gives `996.96` (§2, Finding 6). Row is internally consistent with 988.96, so either the time or points figure is a source typo — needs resolution before Phase 4 points engine is built against it.
3. **Tie-break rule** for hand-timed run placings, given ~200ms real-world precision vs centisecond storage (§6.4).
4. **Mobile coverage** at actual venues — informs whether §5.7's write-queue margin is adequate or whether a stronger offline posture is warranted for any specific location.

---

## 10. Build order recommendation

Phase 0 first — immediate value, zero race-day risk, forces early resolution of the entry-import format. Then Phase 1, shadow-run at a real league event (capture via both old and new methods, compare) before Phase 1 is trusted solo. That comparison is the only test that matters here.

Highest operational risk is the finish-line timekeeper — the only point where an error can silently shift a whole heat. The live count, visible last-three-times, and "missed one" button (§4.4) are worth more engineering attention than any refinement to the matching logic downstream.

1Password menu is available. Press down arrow to select.
