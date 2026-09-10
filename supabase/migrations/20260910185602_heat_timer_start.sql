CREATE TABLE "public"."heat_timer_start" (
  "league_id"  integer                  NOT NULL,
  "run_heat"   integer                  NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "device_id"  text                     NOT NULL,
  CONSTRAINT "heat_timer_start_pkey" PRIMARY KEY (league_id, run_heat)
);

ALTER TABLE "public"."heat_timer_start"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."heat_timer_start"
  ADD CONSTRAINT "heat_timer_start_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE POLICY "Authenticated users can manage heat timer starts" ON "public"."heat_timer_start"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."heat_timer_start" TO "anon", "authenticated", "postgres", "service_role";
