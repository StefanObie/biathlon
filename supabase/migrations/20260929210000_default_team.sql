SET local check_function_bodies = off;

CREATE TABLE "public"."default_team_member" (
  "organization_id" integer            NOT NULL,
  "user_id"         uuid               NOT NULL,
  "role"            public.league_role NOT NULL,
  CONSTRAINT "default_team_member_pkey" PRIMARY KEY (organization_id, user_id, ROLE)
);

ALTER TABLE "public"."default_team_member"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."default_team_member"
  ADD CONSTRAINT "default_team_member_organization_id_user_id_fkey" FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_member(organization_id, user_id) ON DELETE CASCADE;

CREATE INDEX default_team_member_user_idx ON public.default_team_member USING btree (user_id);

ALTER TABLE "public"."audit_log"
  ALTER COLUMN "league_id" DROP NOT NULL;

ALTER TABLE "public"."audit_log"
  ADD COLUMN "organization_id" integer;

ALTER TABLE "public"."audit_log"
  ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organization(id);

ALTER TABLE "public"."audit_log"
  ADD CONSTRAINT "audit_log_check" CHECK (((league_id IS NULL) <> (organization_id IS NULL)));

CREATE INDEX audit_log_organization_idx ON public.audit_log USING btree (organization_id);

CREATE OR REPLACE FUNCTION private.copy_default_team()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.league_team_member (league_id, user_id, role)
  select new.id, d.user_id, d.role
  from public.default_team_member d
  where d.organization_id = new.organization_id;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_default_team_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  changed public.default_team_member;
  team_entry jsonb;
  actor text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
begin
  if tg_op = 'INSERT' then
    changed := new;
  else
    changed := old;
  end if;
  team_entry := jsonb_build_object(
    'user_id', changed.user_id,
    'email', (select email from auth.users where id = changed.user_id),
    'role', changed.role
  );

  if tg_op = 'INSERT' then
    insert into public.audit_log (organization_id, actor, entity, action, after)
    values (changed.organization_id, actor, 'default_team', 'add-role', team_entry);
  else
    insert into public.audit_log (organization_id, actor, entity, action, before)
    values (changed.organization_id, actor, 'default_team', 'remove-role', team_entry);
  end if;
  return null;
end;
$function$;

CREATE TRIGGER league_copy_default_team
  AFTER INSERT ON public.league
  FOR EACH ROW
  EXECUTE FUNCTION private.copy_default_team();

CREATE TRIGGER default_team_member_audit
  AFTER INSERT OR DELETE ON public.default_team_member
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_default_team_change();

CREATE POLICY "Admins can read their organizations' default teams" ON "public"."default_team_member"
  FOR SELECT
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can add to default teams" ON "public"."default_team_member"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can remove from default teams" ON "public"."default_team_member"
  FOR DELETE
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true));

CREATE POLICY "Admins can read their organizations' audit log" ON "public"."audit_log"
  FOR SELECT
  TO "authenticated"
  USING (private.is_org_member(organization_id, as_admin => true));

GRANT EXECUTE ON FUNCTION "private"."copy_default_team"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."audit_default_team_change"() TO "postgres";

REVOKE ALL ON TABLE "public"."default_team_member" FROM "anon";

GRANT INSERT, DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."default_team_member" TO "anon";

REVOKE ALL ON TABLE "public"."default_team_member" FROM "authenticated";

GRANT INSERT, DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE "public"."default_team_member" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."default_team_member" TO "postgres", "service_role";
