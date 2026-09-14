CREATE TABLE "public"."swim_result" (
  "league_id"       integer NOT NULL,
  "athlete_no"      integer NOT NULL,
  "event_no"        integer NOT NULL,
  "heat"            integer NOT NULL,
  "lane"            integer NOT NULL,
  "distance_m"      integer,
  "swim_time"       text,
  "place"           integer,
  "status"          text    NOT NULL DEFAULT 'ok'::text,
  "source"          text    NOT NULL,
  "overridden_by"   text,
  "override_reason" text,
  "source_line"     text,
  "needs_review"    boolean NOT NULL DEFAULT false,
  CONSTRAINT "swim_result_pkey" PRIMARY KEY (league_id, athlete_no),
  CONSTRAINT "swim_result_swim_time_check" CHECK ((swim_time ~ '^\d{2}:\d{2}\.\d{2}$'::text))
);

ALTER TABLE "public"."swim_result"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."swim_result"
  ADD COLUMN "swim_time_cs" integer GENERATED ALWAYS AS (
CASE
    WHEN (swim_time IS NULL) THEN NULL::integer
    ELSE ((((SUBSTRING(swim_time FROM 1 FOR 2))::integer * 6000) + ((SUBSTRING(swim_time FROM 4 FOR 2))::integer * 100)) + (SUBSTRING(swim_time FROM 7 FOR 2))::integer)
END) STORED;

ALTER TABLE "public"."swim_result"
  ADD CONSTRAINT "swim_result_athlete_no_fkey" FOREIGN KEY (athlete_no) REFERENCES public.athlete(athlete_no);

ALTER TABLE "public"."swim_result"
  ADD CONSTRAINT "swim_result_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE INDEX swim_result_heat_lane_idx ON public.swim_result USING btree (league_id, heat, lane);

CREATE POLICY "Authenticated users can manage swim results" ON "public"."swim_result"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."swim_result" TO "anon", "authenticated", "postgres", "service_role";
