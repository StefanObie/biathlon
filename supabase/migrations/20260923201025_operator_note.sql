CREATE TABLE "public"."operator_note" (
  "id"         text                     NOT NULL,
  "league_id"  integer                  NOT NULL,
  "run_heat"   integer                  NOT NULL,
  "anchor"     integer                  NOT NULL,
  "screen"     text                     NOT NULL,
  "body"       text                     NOT NULL,
  "device_id"  text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "operator_note_body_check" CHECK ((body <> ''::text)),
  CONSTRAINT "operator_note_anchor_check" CHECK ((anchor >= 0)),
  CONSTRAINT "operator_note_pkey" PRIMARY KEY (id),
  CONSTRAINT "operator_note_screen_check" CHECK ((screen = ANY (ARRAY['timer'::text, 'position'::text])))
);

ALTER TABLE "public"."operator_note"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."operator_note"
  ADD CONSTRAINT "operator_note_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

CREATE INDEX operator_note_run_heat_idx ON public.operator_note USING btree (league_id, run_heat);

CREATE POLICY "Authenticated users can add operator notes" ON "public"."operator_note"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read operator notes" ON "public"."operator_note"
  FOR SELECT
  TO "authenticated"
  USING (true);

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."operator_note";

REVOKE ALL ON TABLE "public"."operator_note" FROM "anon";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."operator_note" TO "anon";

REVOKE ALL ON TABLE "public"."operator_note" FROM "authenticated";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."operator_note" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operator_note" TO "postgres", "service_role";
