-- Call room check-ins (#41): a flag saying an athlete has reported to the
-- Call room, not a Capture. One row per (League, athlete number): the heat
-- they were checked in at, when, and by whom. Checking in at another heat
-- updates the row; undoing deletes it. The key is the entry's, so an
-- athlete has to be entered in the League.
create table call_room_check_in (
  league_id integer not null,
  athlete_no integer not null,
  run_heat integer not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid,
  primary key (league_id, athlete_no),
  foreign key (league_id, athlete_no) references entry (league_id, athlete_no)
    on delete cascade
);

alter table call_room_check_in enable row level security;

-- The time and the Member are the database's, whatever the phone sent.
create function private.stamp_check_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.checked_in_at := now();
  new.checked_in_by := (select auth.uid());
  return new;
end;
$$;

create trigger call_room_check_in_stamp
  before insert or update on call_room_check_in
  for each row execute function private.stamp_check_in();

-- Whether a heat has been closed by an Official (ADR 0001).
create function private.heat_is_closed(target_league_id integer, target_run_heat integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_race r
    where r.league_id = target_league_id
      and r.run_heat = target_run_heat
      and r.closed_at is not null
  );
$$;

create policy "Team members can read their leagues' check-ins"
  on call_room_check_in for select
  to authenticated
  using (private.has_league_role(league_id));

-- A Closed heat is read-only, including moving an athlete away from it.
create policy "Callers can check in athletes to open heats"
  on call_room_check_in for insert
  to authenticated
  with check (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

create policy "Callers can move check-ins between open heats"
  on call_room_check_in for update
  to authenticated
  using (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  )
  with check (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

create policy "Callers can undo check-ins on open heats"
  on call_room_check_in for delete
  to authenticated
  using (
    private.has_league_role(league_id, 'caller')
    and not private.heat_is_closed(league_id, run_heat)
  );

alter publication supabase_realtime add table call_room_check_in;
