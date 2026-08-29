CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TABLE "athlete" (
	"athlete_no" integer PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" "gender" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry" (
	"meet_id" integer NOT NULL,
	"athlete_no" integer NOT NULL,
	"run_heat" integer NOT NULL,
	"swim_heat" integer NOT NULL,
	"swim_lane" integer NOT NULL,
	"age_group_code" text NOT NULL,
	CONSTRAINT "entry_meet_id_athlete_no_pk" PRIMARY KEY("meet_id","athlete_no")
);
--> statement-breakpoint
CREATE TABLE "meet" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meet_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"meet_date" text NOT NULL,
	"season" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_table" (
	"effective_from" text NOT NULL,
	"gender" "gender" NOT NULL,
	"age_group_code" text NOT NULL,
	"age_group_label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"age_from" integer NOT NULL,
	"age_to" integer NOT NULL,
	"run_distance_m" integer NOT NULL,
	"run_base_time" text NOT NULL,
	"run_points_per_second" numeric NOT NULL,
	"swim_distance_m" integer NOT NULL,
	"swim_base_time" text NOT NULL,
	"swim_points_per_second" numeric NOT NULL,
	"bonus_points_per_year" numeric NOT NULL,
	CONSTRAINT "points_table_effective_from_gender_age_group_code_pk" PRIMARY KEY("effective_from","gender","age_group_code")
);
--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_meet_id_meet_id_fk" FOREIGN KEY ("meet_id") REFERENCES "public"."meet"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_athlete_no_athlete_athlete_no_fk" FOREIGN KEY ("athlete_no") REFERENCES "public"."athlete"("athlete_no") ON DELETE no action ON UPDATE no action;