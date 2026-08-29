CREATE TABLE "public"."athlete" (
  "athlete_no" integer NOT NULL,
  "first_name" text    NOT NULL,
  "last_name"  text    NOT NULL,
  CONSTRAINT "athlete_pkey" PRIMARY KEY (athlete_no)
);

ALTER TABLE "public"."athlete"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."entry" (
  "meet_id"        integer NOT NULL,
  "athlete_no"     integer NOT NULL,
  "run_heat"       integer NOT NULL,
  "swim_heat"      integer NOT NULL,
  "swim_lane"      integer NOT NULL,
  "age_group_code" text    NOT NULL,
  CONSTRAINT "entry_pkey" PRIMARY KEY (meet_id, athlete_no)
);

ALTER TABLE "public"."entry"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."meet" (
  "id"        integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name"      text    NOT NULL,
  "meet_date" date    NOT NULL,
  "season"    integer NOT NULL,
  CONSTRAINT "meet_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."meet"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."points_table" (
  "effective_from"         date    NOT NULL,
  "age_group_code"         text    NOT NULL,
  "age_group_label"        text    NOT NULL,
  "sort_order"             integer NOT NULL,
  "age_from"               integer NOT NULL,
  "age_to"                 integer NOT NULL,
  "run_distance_m"         integer NOT NULL,
  "run_base_time"          text    NOT NULL,
  "run_points_per_second"  numeric NOT NULL,
  "swim_distance_m"        integer NOT NULL,
  "swim_base_time"         text    NOT NULL,
  "swim_points_per_second" numeric NOT NULL,
  "bonus_points_per_year"  numeric NOT NULL
);

ALTER TABLE "public"."points_table"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."gender" AS ENUM (
  'M',
  'F'
);

ALTER TABLE "public"."athlete"
  ADD COLUMN "gender" public.gender NOT NULL;

ALTER TABLE "public"."points_table"
  ADD COLUMN "gender" public.gender NOT NULL;

ALTER TABLE "public"."entry"
  ADD CONSTRAINT "entry_athlete_no_fkey" FOREIGN KEY (athlete_no) REFERENCES public.athlete(athlete_no);

ALTER TABLE "public"."entry"
  ADD CONSTRAINT "entry_meet_id_fkey" FOREIGN KEY (meet_id) REFERENCES public.meet(id);

ALTER TABLE "public"."points_table"
  ADD CONSTRAINT "points_table_pkey" PRIMARY KEY (effective_from, gender, age_group_code);

CREATE INDEX entry_run_heat_idx ON public.entry USING btree (meet_id, run_heat);

CREATE INDEX entry_swim_heat_lane_idx ON public.entry USING btree (meet_id, swim_heat, swim_lane);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."athlete" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entry" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."meet" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."points_table" TO "anon", "authenticated", "postgres", "service_role";

GRANT USAGE ON TYPE "public"."gender" TO "postgres";
