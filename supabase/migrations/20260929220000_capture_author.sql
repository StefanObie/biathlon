SET local check_function_bodies = off;

DROP POLICY "Capture operators can add operator notes" ON "public"."operator_note";

DROP POLICY "Placers can add position captures" ON "public"."position_capture";

DROP POLICY "Placers can void position captures" ON "public"."position_capture";

DROP POLICY "Timekeepers can add time captures" ON "public"."time_capture";

DROP POLICY "Timekeepers can void time captures" ON "public"."time_capture";

ALTER TABLE "public"."operator_note"
  ADD COLUMN "author_id" uuid;

ALTER TABLE "public"."position_capture"
  ADD COLUMN "author_id" uuid;

ALTER TABLE "public"."time_capture"
  ADD COLUMN "author_id" uuid;

CREATE OR REPLACE FUNCTION private.had_league_role (
  target_league_id integer,
  min_role         public.league_role,
  at               timestamp with time zone
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.has_league_role(target_league_id, min_role)
    or exists (
      select 1 from public.league_team_member t
      where t.league_id = target_league_id
        and t.user_id = (select auth.uid())
        and t.started_at <= at
        and t.ended_at > at
        and private.role_covers(t.role, min_role)
    );
$function$;

CREATE OR REPLACE FUNCTION private.set_author()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
  else
    new.author_id := old.author_id;
  end if;
  return new;
end;
$function$;

CREATE TRIGGER operator_note_set_author
  BEFORE INSERT ON public.operator_note
  FOR EACH ROW
  EXECUTE FUNCTION private.set_author();

CREATE TRIGGER position_capture_set_author
  BEFORE INSERT OR UPDATE ON public.position_capture
  FOR EACH ROW
  EXECUTE FUNCTION private.set_author();

CREATE TRIGGER time_capture_set_author
  BEFORE INSERT OR UPDATE ON public.time_capture
  FOR EACH ROW
  EXECUTE FUNCTION private.set_author();

CREATE POLICY "Authors can read their own operator notes" ON "public"."operator_note"
  FOR SELECT
  TO "authenticated"
  USING ((author_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Authors can read their own position captures" ON "public"."position_capture"
  FOR SELECT
  TO "authenticated"
  USING ((author_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Authors can read their own time captures" ON "public"."time_capture"
  FOR SELECT
  TO "authenticated"
  USING ((author_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Capture operators can add operator notes" ON "public"."operator_note"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
CASE screen
    WHEN 'timer'::text THEN private.had_league_role(league_id, 'timekeeper'::public.league_role, created_at)
    WHEN 'position'::text THEN private.had_league_role(league_id, 'placer'::public.league_role, created_at)
    ELSE NULL::boolean
END);

CREATE POLICY "Placers can add position captures" ON "public"."position_capture"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.had_league_role(league_id, 'placer'::public.league_role, scanned_at));

CREATE POLICY "Placers can void position captures" ON "public"."position_capture"
  FOR UPDATE
  TO "authenticated"
  USING ((private.has_league_role(league_id, 'placer'::public.league_role) OR ((author_id = ( SELECT auth.uid() AS uid)) AND private.had_league_role(league_id,
    'placer'::public.league_role, scanned_at))))
  WITH CHECK ((private.has_league_role(league_id, 'placer'::public.league_role) OR ((author_id = ( SELECT auth.uid() AS uid)) AND private.had_league_role(league_id,
    'placer'::public.league_role, scanned_at))));

CREATE POLICY "Timekeepers can void time captures" ON "public"."time_capture"
  FOR UPDATE
  TO "authenticated"
  USING ((private.has_league_role(league_id, 'timekeeper'::public.league_role) OR ((author_id = ( SELECT auth.uid() AS uid)) AND private.had_league_role(league_id,
    'timekeeper'::public.league_role, captured_at))))
  WITH CHECK ((private.has_league_role(league_id, 'timekeeper'::public.league_role) OR ((author_id = ( SELECT auth.uid() AS uid)) AND private.had_league_role(league_id,
    'timekeeper'::public.league_role, captured_at))));

CREATE POLICY "Timekeepers can add time captures" ON "public"."time_capture"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (private.had_league_role(league_id, 'timekeeper'::public.league_role, captured_at));

GRANT EXECUTE ON FUNCTION "private"."had_league_role"(integer, public.league_role, timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."set_author"() TO "postgres";
