CREATE TABLE "public"."league_race" (
  "league_id"  integer                  NOT NULL,
  "run_heat"   integer                  NOT NULL,
  "started_at" timestamp with time zone,
  "device_id"  text,
  CONSTRAINT "league_race_pkey" PRIMARY KEY (league_id, run_heat)
);

ALTER TABLE "public"."league_race"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_race"
  ADD CONSTRAINT "league_race_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE POLICY "Authenticated users can manage league races" ON "public"."league_race"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."league_race" TO "anon", "authenticated", "postgres", "service_role";
