SET local check_function_bodies = off;

DROP POLICY "Members can manage their organizations' athletes" ON "public"."athlete";

DROP POLICY "Members can manage their leagues' audit log" ON "public"."audit_log";

DROP POLICY "Members can manage their leagues' entries" ON "public"."entry";

DROP POLICY "Members can read their organizations' leagues" ON "public"."league";

DROP POLICY "Members can manage their leagues' league races" ON "public"."league_race";

DROP POLICY "Members can add operator notes to their leagues" ON "public"."operator_note";

DROP POLICY "Members can read their leagues' operator notes" ON "public"."operator_note";

DROP POLICY "Members can manage their leagues' position captures" ON "public"."position_capture";

DROP POLICY "Members can manage their leagues' run results" ON "public"."run_result";

DROP POLICY "Members can manage their leagues' swim results" ON "public"."swim_result";

DROP POLICY "Members can manage their leagues' time captures" ON "public"."time_capture";

DROP FUNCTION "private"."can_access_league"(integer);

CREATE TABLE "public"."league_team_member" (
  "id"              integer                  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "league_id"       integer                  NOT NULL,
  "organization_id" integer                  NOT NULL DEFAULT 0,
  "user_id"         uuid                     NOT NULL,
  "started_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at"        timestamp with time zone,
  CONSTRAINT "league_team_member_check" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
  CONSTRAINT "league_team_member_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."league_team_member"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."league_role" AS ENUM (
  'official',
  'timekeeper',
  'placer'
);

ALTER TABLE "public"."league_team_member"
  ADD COLUMN "role" public.league_role NOT NULL;

CREATE OR REPLACE FUNCTION private.audit_league_team_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  team_entry jsonb := jsonb_build_object(
    'league_id', new.league_id,
    'user_id', new.user_id,
    'email', (select email from auth.users where id = new.user_id),
    'role', new.role
  );
  actor text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (league_id, actor, entity, action, after)
    values (new.league_id, actor, 'league_team', 'add-role', team_entry);
  elsif old.ended_at is null and new.ended_at is not null then
    insert into public.audit_log (league_id, actor, entity, action, before)
    values (new.league_id, actor, 'league_team', 'remove-role', team_entry);
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.has_league_role (
  target_league_id integer,
  min_role         public.league_role DEFAULT NULL::public.league_role
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.league l
    where l.id = target_league_id
      and (
        private.is_org_member(l.organization_id, as_admin => true)
        or exists (
          select 1 from public.league_team_member t
          where t.league_id = l.id
            and t.user_id = (select auth.uid())
            and t.ended_at is null
            and private.role_covers(t.role, min_role)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.has_org_role (
  org_id   integer,
  min_role public.league_role DEFAULT NULL::public.league_role
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.is_org_member(org_id, as_admin => true)
    or exists (
      select 1 from public.league_team_member t
      where t.organization_id = org_id
        and t.user_id = (select auth.uid())
        and t.ended_at is null
        and private.role_covers(t.role, min_role)
    );
$function$;

CREATE OR REPLACE FUNCTION private.league_team_member_keeps_history()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.ended_at := null;
    return new;
  end if;

  if old.ended_at is not null
    or new.league_id is distinct from old.league_id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.started_at is distinct from old.started_at
  then
    raise exception 'A league team entry can only be ended';
  end if;
  if new.ended_at is not null then
    new.ended_at := now();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.role_covers (
  held     public.league_role,
  required public.league_role
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select required is null or held = required or held = 'official';
$function$;

CREATE OR REPLACE FUNCTION public.organization_members (
  org_id integer
)
  RETURNS TABLE (
    user_id  uuid,
    email    text,
    is_admin boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select m.user_id, u.email::text, m.is_admin
  from public.organization_member m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org_id
    and private.is_org_member(org_id, as_admin => true)
  order by u.email;
$function$;

REVOKE ALL ON FUNCTION "public"."organization_members"(integer) FROM PUBLIC, "anon";

ALTER TABLE "public"."league_team_member"
  ADD CONSTRAINT "league_team_member_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

ALTER TABLE "public"."league_team_member"
  ADD CONSTRAINT "league_team_member_organization_id_user_id_fkey" FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_member(organization_id, user_id);

CREATE UNIQUE INDEX league_team_member_current_idx ON public.league_team_member USING btree (league_id, user_id, ROLE)
  WHERE (ended_at IS NULL);

CREATE INDEX league_team_member_member_idx ON public.league_team_member USING btree (organization_id, user_id);

CREATE INDEX league_team_member_user_idx ON public.league_team_member USING btree (user_id);

CREATE TRIGGER league_team_member_audit
  AFTER INSERT OR UPDATE ON public.league_team_member
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_league_team_change();

CREATE TRIGGER league_team_member_keeps_history
  BEFORE INSERT OR UPDATE ON public.league_team_member
  FOR EACH ROW
  EXECUTE FUNCTION private.league_team_member_keeps_history();

CREATE TRIGGER league_team_member_set_organization
  BEFORE INSERT OR UPDATE ON public.league_team_member
  FOR EACH ROW
  EXECUTE FUNCTION private.set_organization_from_league();

CREATE POLICY "Officials can add athletes" ON "public"."athlete"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.has_org_role(organization_id, 'official'::public.league_role));

CREATE POLICY "Officials can delete athletes" ON "public"."athlete"
  FOR DELETE
  TO "authenticated"
  USING (private.has_org_role(organization_id, 'official'::public.league_role));

CREATE POLICY "Officials can update athletes" ON "public"."athlete"
  FOR UPDATE
  TO "authenticated"
  USING (private.has_org_role(organization_id, 'official'::public.league_role))
  WITH CHECK (private.has_org_role(organization_id, 'official'::public.league_role));

CREATE POLICY "Team members can read their organizations' athletes" ON "public"."athlete"
  FOR SELECT
  TO "authenticated"
  USING (private.has_org_role(organization_id));

CREATE POLICY "Officials can read their leagues' audit log" ON "public"."audit_log"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Officials can write their leagues' audit log" ON "public"."audit_log"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Officials can add entries" ON "public"."entry"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Officials can delete entries" ON "public"."entry"
  FOR DELETE
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Officials can update entries" ON "public"."entry"
  FOR UPDATE
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role))
  WITH CHECK (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Team members can read their leagues' entries" ON "public"."entry"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Team members can read their leagues" ON "public"."league"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(id));

CREATE POLICY "Team members can read their leagues' heats" ON "public"."league_race"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Timekeepers can fill in open heats, and Officials close and reo" ON "public"."league_race"
  FOR UPDATE
  TO "authenticated"
  USING ((private.has_league_role(league_id, 'official'::public.league_role) OR (private.has_league_role(league_id, 'timekeeper'::public.league_role) AND (closed_at IS NULL))))
  WITH
    CHECK
    ((private.has_league_role(league_id, 'official'::public.league_role) OR (private.has_league_role(league_id, 'timekeeper'::public.league_role) AND (closed_at IS NULL) AND
    (closed_by IS NULL))));

CREATE POLICY "Timekeepers can reset open heats, and Officials any heat" ON "public"."league_race"
  FOR DELETE
  TO "authenticated"
  USING ((private.has_league_role(league_id, 'official'::public.league_role) OR (private.has_league_role(league_id, 'timekeeper'::public.league_role) AND (closed_at IS NULL))));

CREATE POLICY "Timekeepers can start heats, and Officials close them" ON "public"."league_race"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    ((private.has_league_role(league_id, 'official'::public.league_role) OR (private.has_league_role(league_id, 'timekeeper'::public.league_role) AND (closed_at IS NULL) AND
    (closed_by IS NULL))));

CREATE POLICY "Admins can add to league teams" ON "public"."league_team_member"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can end league team entries" ON "public"."league_team_member"
  FOR UPDATE
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true))
  WITH CHECK (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Team members can read their leagues' teams" ON "public"."league_team_member"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Capture operators can add operator notes" ON "public"."operator_note"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
CASE screen
    WHEN 'timer'::text THEN private.has_league_role(league_id, 'timekeeper'::public.league_role)
    WHEN 'position'::text THEN private.has_league_role(league_id, 'placer'::public.league_role)
    ELSE NULL::boolean
END);

CREATE POLICY "Team members can read their leagues' operator notes" ON "public"."operator_note"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Placers can add position captures" ON "public"."position_capture"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.has_league_role(league_id, 'placer'::public.league_role));

CREATE POLICY "Placers can void position captures" ON "public"."position_capture"
  FOR UPDATE
  TO "authenticated"
  USING (private.has_league_role(league_id, 'placer'::public.league_role))
  WITH CHECK (private.has_league_role(league_id, 'placer'::public.league_role));

CREATE POLICY "Team members can read their leagues' position captures" ON "public"."position_capture"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Officials can manage their leagues' run results" ON "public"."run_result"
  FOR ALL
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role))
  WITH CHECK (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Officials can manage their leagues' swim results" ON "public"."swim_result"
  FOR ALL
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role))
  WITH CHECK (private.has_league_role(league_id, 'official'::public.league_role));

CREATE POLICY "Team members can read their leagues' time captures" ON "public"."time_capture"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id));

CREATE POLICY "Timekeepers can add time captures" ON "public"."time_capture"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.has_league_role(league_id, 'timekeeper'::public.league_role));

CREATE POLICY "Timekeepers can void time captures" ON "public"."time_capture"
  FOR UPDATE
  TO "authenticated"
  USING (private.has_league_role(league_id, 'timekeeper'::public.league_role))
  WITH CHECK (private.has_league_role(league_id, 'timekeeper'::public.league_role));

GRANT EXECUTE ON FUNCTION "private"."audit_league_team_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."has_league_role"(integer, public.league_role) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."has_org_role"(integer, public.league_role) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."league_team_member_keeps_history"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."role_covers"(public.league_role, public.league_role) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."organization_members"(integer) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."league_team_member" FROM "anon";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE ON TABLE "public"."league_team_member" TO "anon";

REVOKE ALL ON TABLE "public"."league_team_member" FROM "authenticated";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE ON TABLE "public"."league_team_member" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."league_team_member" TO "postgres", "service_role";

GRANT USAGE ON TYPE "public"."league_role" TO "postgres";
