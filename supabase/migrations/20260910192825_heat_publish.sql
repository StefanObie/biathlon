CREATE TABLE "public"."heat_publish" (
  "league_id"    integer                  NOT NULL,
  "run_heat"     integer                  NOT NULL,
  "published_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_by" text                     NOT NULL,
  CONSTRAINT "heat_publish_pkey" PRIMARY KEY (league_id, run_heat)
);

ALTER TABLE "public"."heat_publish"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."heat_publish"
  ADD CONSTRAINT "heat_publish_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE POLICY "Authenticated users can manage heat publish" ON "public"."heat_publish"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."heat_publish" TO "anon", "authenticated", "postgres", "service_role";
