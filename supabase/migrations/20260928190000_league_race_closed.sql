ALTER TABLE "public"."league_race"
  ADD COLUMN "closed_at" timestamp with time zone;

ALTER TABLE "public"."league_race"
  ADD COLUMN "closed_by" text;

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."league_race";
