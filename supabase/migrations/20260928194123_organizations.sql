SET local check_function_bodies = off;

DROP POLICY "Authenticated users can manage audit log" ON "public"."audit_log";

DROP POLICY "Authenticated users can manage entries" ON "public"."entry";

DROP POLICY "Authenticated users can manage leagues" ON "public"."league";

DROP POLICY "Authenticated users can manage league races" ON "public"."league_race";

DROP POLICY "Authenticated users can add operator notes" ON "public"."operator_note";

DROP POLICY "Authenticated users can read operator notes" ON "public"."operator_note";

DROP POLICY "Authenticated users can manage position captures" ON "public"."position_capture";

DROP POLICY "Authenticated users can manage run results" ON "public"."run_result";

DROP POLICY "Authenticated users can manage swim results" ON "public"."swim_result";

DROP POLICY "Authenticated users can manage time captures" ON "public"."time_capture";

CREATE SCHEMA "private";

CREATE TABLE "public"."organization_member" (
  "organization_id" integer NOT NULL,
  "user_id"         uuid    NOT NULL,
  "is_admin"        boolean NOT NULL DEFAULT false,
  CONSTRAINT "organization_member_pkey" PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE "public"."organization_member"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."organization" (
  "id"   integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name" text    NOT NULL,
  CONSTRAINT "organization_name_check" CHECK ((name <> ''::text)),
  CONSTRAINT "organization_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."organization"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."audit_log"
  ADD COLUMN "league_id" integer;

ALTER TABLE "public"."league"
  ADD COLUMN "organization_id" integer;

-- Hand-written data migration (#29): everything that exists today belongs to
-- Gauteng North Biathlon. Its Admin is added by hand after this runs, so no
-- account is named here, and no existing user is added.
DO $$
DECLARE
  gauteng_north_id integer;
BEGIN
  INSERT INTO public.organization (name)
  VALUES ('Gauteng North Biathlon')
  RETURNING id INTO gauteng_north_id;

  UPDATE public.league SET organization_id = gauteng_north_id;
END
$$;

-- Existing audit rows didn't record their league as a column, only inside
-- the entity name or the before/after snapshot, depending on what wrote them.
-- Rows that carry no league at all (a reconcile-save with nothing to save)
-- fall back to the earliest league: every existing league is in the one
-- Organization above, so who can read them doesn't change.
UPDATE public.audit_log
SET league_id = coalesce(
  (after ->> 'league_id')::integer,
  (before ->> 'league_id')::integer,
  (after -> 0 ->> 'league_id')::integer,
  CASE WHEN entity ~ '^[a-z_]+:\d+' THEN split_part(entity, ':', 2)::integer END,
  (SELECT min(id) FROM public.league)
);

ALTER TABLE "public"."audit_log"
  ALTER COLUMN "league_id" SET NOT NULL;

ALTER TABLE "public"."league"
  ALTER COLUMN "organization_id" SET NOT NULL;

CREATE OR REPLACE FUNCTION private.can_access_league (
  target_league_id integer
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select coalesce(
    (
      select private.is_org_member(organization_id)
      from public.league
      where id = target_league_id
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_org_member (
  org_id   integer,
  as_admin boolean DEFAULT false
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.organization_member
    where organization_id = org_id
      and user_id = (select auth.uid())
      and (is_admin or not as_admin)
  );
$function$;

CREATE OR REPLACE FUNCTION private.league_organization_is_fixed()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A league''s organization cannot be changed';
  end if;
  return new;
end;
$function$;

ALTER TABLE "public"."audit_log"
  ADD CONSTRAINT "audit_log_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

ALTER TABLE "public"."league"
  ADD CONSTRAINT "league_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id);

ALTER TABLE "public"."organization_member"
  ADD CONSTRAINT "organization_member_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;

ALTER TABLE "public"."organization_member"
  ADD CONSTRAINT "organization_member_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX audit_log_league_idx ON public.audit_log USING btree (league_id);

CREATE INDEX league_organization_idx ON public.league USING btree (organization_id);

CREATE INDEX organization_member_user_idx ON public.organization_member USING btree (user_id);

CREATE TRIGGER league_organization_is_fixed
  BEFORE UPDATE ON public.league
  FOR EACH ROW
  EXECUTE FUNCTION private.league_organization_is_fixed();

CREATE POLICY "Members can manage their leagues' audit log" ON "public"."audit_log"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can manage their leagues' entries" ON "public"."entry"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Admins can create leagues" ON "public"."league"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can delete leagues" ON "public"."league"
  FOR DELETE
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can update leagues" ON "public"."league"
  FOR UPDATE
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true))
  WITH CHECK (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Members can read their organizations' leagues" ON "public"."league"
  FOR SELECT
  TO "authenticated"
  USING (private.is_org_member(organization_id));

CREATE POLICY "Members can manage their leagues' league races" ON "public"."league_race"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can add operator notes to their leagues" ON "public"."operator_note"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can read their leagues' operator notes" ON "public"."operator_note"
  FOR SELECT
  TO "authenticated"
  USING (private.can_access_league(league_id));

CREATE POLICY "Members can read their organizations" ON "public"."organization"
  FOR SELECT
  TO "authenticated"
  USING (private.is_org_member(id));

CREATE POLICY "Members can read their organizations' memberships" ON "public"."organization_member"
  FOR SELECT
  TO "authenticated"
  USING (private.is_org_member(organization_id));

CREATE POLICY "Members can manage their leagues' position captures" ON "public"."position_capture"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can manage their leagues' run results" ON "public"."run_result"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can manage their leagues' swim results" ON "public"."swim_result"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

CREATE POLICY "Members can manage their leagues' time captures" ON "public"."time_capture"
  FOR ALL
  TO "authenticated"
  USING (private.can_access_league(league_id))
  WITH CHECK (private.can_access_league(league_id));

GRANT EXECUTE ON FUNCTION "private"."can_access_league"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."is_org_member"(integer, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."league_organization_is_fixed"() TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT CREATE, USAGE ON SCHEMA "private" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_member" TO "anon", "authenticated", "postgres", "service_role";
