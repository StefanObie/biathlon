ALTER SEQUENCE "public"."meet_id_seq" RENAME TO "league_id_seq";

CREATE TABLE "public"."audit_log" (
  "id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "at"     timestamp with time zone NOT NULL DEFAULT now(),
  "actor"  text                     NOT NULL,
  "entity" text                     NOT NULL,
  "action" text                     NOT NULL,
  "before" jsonb,
  "after"  jsonb,
  "reason" text,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."position_capture" (
  "id"          text                     NOT NULL,
  "league_id"   integer                  NOT NULL,
  "run_heat"    integer                  NOT NULL,
  "position"    integer                  NOT NULL,
  "athlete_no"  integer,
  "device_id"   text                     NOT NULL,
  "scanned_at"  timestamp with time zone NOT NULL,
  "voided"      boolean                  NOT NULL DEFAULT false,
  "void_reason" text,
  CONSTRAINT "position_capture_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."position_capture"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."run_result" (
  "league_id"       integer NOT NULL,
  "athlete_no"      integer NOT NULL,
  "run_heat"        integer NOT NULL,
  "run_time"        text,
  "status"          text    NOT NULL DEFAULT 'ok'::text,
  "source"          text    NOT NULL,
  "overridden_by"   text,
  "override_reason" text,
  CONSTRAINT "run_result_pkey" PRIMARY KEY (league_id, athlete_no, run_heat),
  CONSTRAINT "run_result_run_time_check" CHECK ((run_time ~ '^\d{2}:\d{2}\.\d{2}$'::text))
);

ALTER TABLE "public"."run_result"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."time_capture" (
  "id"             text                     NOT NULL,
  "league_id"      integer                  NOT NULL,
  "run_heat"       integer                  NOT NULL,
  "seq"            integer                  NOT NULL,
  "elapsed_time"   text                     NOT NULL,
  "is_placeholder" boolean                  NOT NULL DEFAULT false,
  "device_id"      text                     NOT NULL,
  "captured_at"    timestamp with time zone NOT NULL,
  "voided"         boolean                  NOT NULL DEFAULT false,
  "void_reason"    text,
  CONSTRAINT "time_capture_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."time_capture"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."run_result"
  ADD COLUMN "run_time_cs" integer GENERATED ALWAYS AS (
CASE
    WHEN (run_time IS NULL) THEN NULL::integer
    ELSE ((((SUBSTRING(run_time FROM 1 FOR 2))::integer * 6000) + ((SUBSTRING(run_time FROM 4 FOR 2))::integer * 100)) + (SUBSTRING(run_time FROM 7 FOR 2))::integer)
END) STORED;

ALTER TABLE "public"."position_capture"
  ADD CONSTRAINT "position_capture_athlete_no_fkey" FOREIGN KEY (athlete_no) REFERENCES public.athlete(athlete_no);

ALTER TABLE "public"."position_capture"
  ADD CONSTRAINT "position_capture_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

ALTER TABLE "public"."run_result"
  ADD CONSTRAINT "run_result_athlete_no_fkey" FOREIGN KEY (athlete_no) REFERENCES public.athlete(athlete_no);

ALTER TABLE "public"."run_result"
  ADD CONSTRAINT "run_result_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

ALTER TABLE "public"."time_capture"
  ADD CONSTRAINT "time_capture_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE INDEX position_capture_run_heat_idx ON public.position_capture USING btree (league_id, run_heat);

CREATE INDEX run_result_run_heat_idx ON public.run_result USING btree (league_id, run_heat);

CREATE INDEX time_capture_run_heat_idx ON public.time_capture USING btree (league_id, run_heat);

CREATE POLICY "Authenticated users can manage audit log" ON "public"."audit_log"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage position captures" ON "public"."position_capture"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage run results" ON "public"."run_result"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage time captures" ON "public"."time_capture"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."position_capture" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."run_result" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."time_capture" TO "anon", "authenticated", "postgres", "service_role";
