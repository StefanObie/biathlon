SET local check_function_bodies = off;

CREATE TABLE "public"."reconciliation_row" (
  "league_id"           integer NOT NULL,
  "run_heat"            integer NOT NULL,
  "row_no"              integer NOT NULL,
  "athlete_no"          integer,
  "run_time"            text,
  "status"              text    NOT NULL DEFAULT 'ok'::text,
  "position_capture_id" text,
  "time_capture_id"     text,
  CONSTRAINT "reconciliation_row_pkey" PRIMARY KEY (league_id, run_heat, row_no),
  CONSTRAINT "reconciliation_row_run_time_check" CHECK ((run_time ~ '^\d{2}:\d{2}\.\d{2}$'::text))
);

ALTER TABLE "public"."reconciliation_row"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.reconciliation_state (
  target_league_id integer,
  target_run_heat  integer
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'reconciliation', coalesce((
      select jsonb_agg(jsonb_build_object(
        'athlete_no', r.athlete_no, 'run_time', r.run_time, 'status', r.status,
        'position_capture_id', r.position_capture_id,
        'time_capture_id', r.time_capture_id
      ) order by r.row_no)
      from public.reconciliation_row r
      where r.league_id = target_league_id and r.run_heat = target_run_heat
    ), '[]'::jsonb),
    'run_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'athlete_no', rr.athlete_no, 'run_time', rr.run_time, 'status', rr.status
      ) order by rr.athlete_no)
      from public.run_result rr
      where rr.league_id = target_league_id and rr.run_heat = target_run_heat
    ), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.save_reconciliation (
  target_league_id integer,
  target_run_heat  integer,
  reconciliation   jsonb
)
  RETURNS timestamp WITH time zone
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor text := coalesce((select auth.jwt() ->> 'email'), 'unknown');
  closed timestamptz := now();
  before_state jsonb;
  duplicate integer;
begin
  if not private.has_league_role(target_league_id, 'official') then
    raise exception 'Only an Official of the League can save a Reconciliation'
      using errcode = '42501';
  end if;
  -- A Closed heat's results are published: changing them means reopening
  -- the heat with a reason first.
  if private.heat_is_closed(target_league_id, target_run_heat) then
    raise exception 'Heat % is closed. Reopen it to change its Reconciliation.', target_run_heat
      using errcode = '42501';
  end if;
  select (r ->> 'athlete_no')::integer into duplicate
  from jsonb_array_elements(reconciliation) r
  where r ->> 'athlete_no' is not null
  group by 1
  having count(*) > 1
  limit 1;
  if duplicate is not null then
    raise exception '#% is on more than one row', duplicate
      using errcode = '23505';
  end if;

  before_state := private.reconciliation_state(target_league_id, target_run_heat);

  delete from public.reconciliation_row
  where league_id = target_league_id and run_heat = target_run_heat;
  insert into public.reconciliation_row (
    league_id, run_heat, row_no, athlete_no, run_time, status,
    position_capture_id, time_capture_id
  )
  select target_league_id, target_run_heat, r.row_no::integer,
    (r.value ->> 'athlete_no')::integer, r.value ->> 'run_time',
    coalesce(r.value ->> 'status', 'ok'),
    r.value ->> 'position_capture_id', r.value ->> 'time_capture_id'
  from jsonb_array_elements(reconciliation) with ordinality as r (value, row_no);

  -- A heat's Run results are exactly the athletes on its Reconciliation:
  -- an athlete changed or removed from a row loses their result.
  delete from public.run_result rr
  where rr.league_id = target_league_id and rr.run_heat = target_run_heat
    and not exists (
      select 1 from public.reconciliation_row r
      where r.league_id = target_league_id and r.run_heat = target_run_heat
        and r.athlete_no = rr.athlete_no
    );
  insert into public.run_result (
    league_id, athlete_no, run_heat, run_time, status, source,
    overridden_by, override_reason
  )
  select league_id, athlete_no, run_heat,
    case when status = 'ok' then run_time end, status, 'manual',
    actor, 'reconciliation save'
  from public.reconciliation_row
  where league_id = target_league_id and run_heat = target_run_heat
    and athlete_no is not null
  on conflict (league_id, athlete_no, run_heat) do update set
    run_time = excluded.run_time,
    status = excluded.status,
    source = excluded.source,
    overridden_by = excluded.overridden_by,
    override_reason = excluded.override_reason;

  insert into public.league_race (league_id, run_heat, closed_at, closed_by)
  values (target_league_id, target_run_heat, closed, actor)
  on conflict (league_id, run_heat) do update set
    closed_at = excluded.closed_at,
    closed_by = excluded.closed_by;

  insert into public.audit_log (league_id, actor, entity, action, before, after, reason)
  values (
    target_league_id, actor, 'reconciliation', 'reconcile-save',
    before_state,
    private.reconciliation_state(target_league_id, target_run_heat),
    format('Reconciled run heat %s', target_run_heat)
  ), (
    target_league_id, actor, 'league_race', 'close',
    null,
    jsonb_build_object('league_id', target_league_id, 'run_heat', target_run_heat,
      'closed_at', closed, 'closed_by', actor),
    format('Closed run heat %s', target_run_heat)
  );

  return closed;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."save_reconciliation"(integer, integer, jsonb) FROM PUBLIC, "anon";

ALTER TABLE "public"."reconciliation_row"
  ADD CONSTRAINT "reconciliation_row_league_id_fkey" FOREIGN KEY (league_id) REFERENCES public.league(id);

ALTER TABLE "public"."reconciliation_row"
  ADD CONSTRAINT "reconciliation_row_position_capture_id_fkey" FOREIGN KEY (position_capture_id) REFERENCES public.position_capture(id);

ALTER TABLE "public"."reconciliation_row"
  ADD CONSTRAINT "reconciliation_row_time_capture_id_fkey" FOREIGN KEY (time_capture_id) REFERENCES public.time_capture(id);

CREATE POLICY "Officials can read their leagues' reconciliations" ON "public"."reconciliation_row"
  FOR SELECT
  TO "authenticated"
  USING (private.has_league_role(league_id, 'official'::public.league_role));

GRANT EXECUTE ON FUNCTION "public"."save_reconciliation"(integer, integer, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_reconciliation"(integer, integer, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_reconciliation"(integer, integer, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_reconciliation"(integer, integer, jsonb) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reconciliation_row" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."reconciliation_row" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reconciliation_row" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reconciliation_row" TO "service_role";
