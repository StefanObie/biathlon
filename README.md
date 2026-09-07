# Biathlon race-day results system

A phone-based results system for SA Biathlon league days. Today, finishing position is written down by hand at the finish line and run times come from a timing-system CSV; someone then combines the two on a PC afterward, which is slow for a large field. This project captures position and time live as athletes finish, matches the two streams automatically, and only needs an official when something doesn't line up. Swim-time matching and the final results export are also part of the system, built on top of the existing swim timing file.

See [biathlon-technical-spec.md](./biathlon-technical-spec.md) for the full design and [biathlon-client-overview.md](./biathlon-client-overview.md) for the plain-language project summary.

## Status

Phase 0 (see the technical spec's phasing table): entry import, roster, bib generation, and operator login are built. The finish-line timer, results-table scanner, and reconciliation screen (Phase 1) are next.

## Stack

TypeScript, Next.js (App Router) on Vercel, Supabase (Postgres, Auth, RLS, declarative schemas via the Supabase CLI), shadcn/ui, Vitest.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Supabase stack (requires the [Supabase CLI](https://supabase.com/docs/guides/local-development)):

   ```bash
   npx supabase start
   ```

   This prints a local `API URL` and `anon key` — copy `.env.example` to `.env.local` and fill those in.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   The app runs at [localhost:3000](http://localhost:3000). Sign-in is email + one-time code, not a password — codes are sent through Supabase's local email inbox (printed in the `supabase start` output as `Inbucket URL`).

## Scripts

| Command                           | Does                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server                                        |
| `npm run build` / `npm run start` | Production build and start                                          |
| `npm run lint`                    | ESLint                                                              |
| `npm run test`                    | Vitest                                                              |
| `npm run db:diff <name>`          | Diff `supabase/schemas/` against the local DB and write a migration |
| `npm run db:migrate`              | Apply pending migrations                                            |
| `npm run db:types`                | Regenerate `lib/supabase/database.types.ts` from the local DB       |

Schema changes go in `supabase/schemas/core.sql`; generated migrations live in `supabase/migrations/` and are reviewed before applying, since `points_table` is versioned by season.
