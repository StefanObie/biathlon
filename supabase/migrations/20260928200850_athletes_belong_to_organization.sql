SET local check_function_bodies = off;

DROP POLICY "Authenticated users can manage athletes" ON "public"."athlete";

ALTER TABLE "public"."entry"
  DROP CONSTRAINT "entry_athlete_no_fkey";

ALTER TABLE "public"."position_capture"
  DROP CONSTRAINT "position_capture_athlete_no_fkey";

ALTER TABLE "public"."run_result"
  DROP CONSTRAINT "run_result_athlete_no_fkey";

ALTER TABLE "public"."swim_result"
  DROP CONSTRAINT "swim_result_athlete_no_fkey";

ALTER TABLE "public"."athlete"
  DROP CONSTRAINT "athlete_pkey";

ALTER TABLE "public"."athlete"
  ADD COLUMN "organization_id" integer;

ALTER TABLE "public"."entry"
  ADD COLUMN "organization_id" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."position_capture"
  ADD COLUMN "organization_id" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."run_result"
  ADD COLUMN "organization_id" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."swim_result"
  ADD COLUMN "organization_id" integer NOT NULL DEFAULT 0;

-- Hand-written data migration (#31): every existing athlete belongs to
-- Gauteng North Biathlon, the only Organization so far, and every row that
-- names an athlete takes its League's Organization.
UPDATE public.athlete
SET organization_id = (
  SELECT id FROM public.organization WHERE name = 'Gauteng North Biathlon'
);

ALTER TABLE "public"."athlete"
  ALTER COLUMN "organization_id" SET NOT NULL;

UPDATE public.entry e SET organization_id = l.organization_id
FROM public.league l WHERE l.id = e.league_id;

UPDATE public.position_capture c SET organization_id = l.organization_id
FROM public.league l WHERE l.id = c.league_id;

UPDATE public.run_result r SET organization_id = l.organization_id
FROM public.league l WHERE l.id = r.league_id;

UPDATE public.swim_result r SET organization_id = l.organization_id
FROM public.league l WHERE l.id = r.league_id;

CREATE OR REPLACE FUNCTION private.set_organization_from_league()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  select organization_id into new.organization_id
  from public.league
  where id = new.league_id;
  return new;
end;
$function$;

ALTER TABLE "public"."athlete"
  ADD CONSTRAINT "athlete_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id);

ALTER TABLE "public"."athlete"
  ADD CONSTRAINT "athlete_pkey" PRIMARY KEY (organization_id, athlete_no);

ALTER TABLE "public"."entry"
  ADD CONSTRAINT "entry_organization_id_athlete_no_fkey" FOREIGN KEY (organization_id, athlete_no) REFERENCES public.athlete(organization_id, athlete_no);

ALTER TABLE "public"."position_capture"
  ADD CONSTRAINT "position_capture_organization_id_athlete_no_fkey" FOREIGN KEY (organization_id, athlete_no) REFERENCES public.athlete(organization_id, athlete_no);

ALTER TABLE "public"."run_result"
  ADD CONSTRAINT "run_result_organization_id_athlete_no_fkey" FOREIGN KEY (organization_id, athlete_no) REFERENCES public.athlete(organization_id, athlete_no);

ALTER TABLE "public"."swim_result"
  ADD CONSTRAINT "swim_result_organization_id_athlete_no_fkey" FOREIGN KEY (organization_id, athlete_no) REFERENCES public.athlete(organization_id, athlete_no);

CREATE TRIGGER entry_set_organization
  BEFORE INSERT OR UPDATE ON public.entry
  FOR EACH ROW
  EXECUTE FUNCTION private.set_organization_from_league();

CREATE TRIGGER position_capture_set_organization
  BEFORE INSERT OR UPDATE ON public.position_capture
  FOR EACH ROW
  EXECUTE FUNCTION private.set_organization_from_league();

CREATE TRIGGER run_result_set_organization
  BEFORE INSERT OR UPDATE ON public.run_result
  FOR EACH ROW
  EXECUTE FUNCTION private.set_organization_from_league();

CREATE TRIGGER swim_result_set_organization
  BEFORE INSERT OR UPDATE ON public.swim_result
  FOR EACH ROW
  EXECUTE FUNCTION private.set_organization_from_league();

CREATE POLICY "Members can manage their organizations' athletes" ON "public"."athlete"
  FOR ALL
  TO "authenticated"
  USING (private.is_org_member(organization_id))
  WITH CHECK (private.is_org_member(organization_id));

GRANT EXECUTE ON FUNCTION "private"."set_organization_from_league"() TO "postgres";
