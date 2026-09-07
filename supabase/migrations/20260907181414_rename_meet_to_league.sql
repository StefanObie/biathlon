-- Rename meet -> league throughout (terminology change only, same grain:
-- one day, one session, many heats — see biathlon-technical-spec.md §6.2).
-- Hand-written as an in-place rename (not a generated drop/recreate) to
-- preserve existing rows.

ALTER TABLE "public"."meet" RENAME TO "league";

ALTER TABLE "public"."league" RENAME CONSTRAINT "meet_pkey" TO "league_pkey";

ALTER TABLE "public"."league" RENAME COLUMN "meet_date" TO "league_date";

ALTER TABLE "public"."entry" RENAME COLUMN "meet_id" TO "league_id";

ALTER TABLE "public"."entry" RENAME CONSTRAINT "entry_meet_id_fkey" TO "entry_league_id_fkey";

DROP POLICY "Authenticated users can manage meets" ON "public"."league";

CREATE POLICY "Authenticated users can manage leagues" ON "public"."league"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);
