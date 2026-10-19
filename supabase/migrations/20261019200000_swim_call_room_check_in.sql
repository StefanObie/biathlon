-- Swim call room check-ins: a flag saying an athlete has reported to the
-- Call room for a swim heat. Information only: nothing reads it to set or
-- refuse a swim result, and swim heats are never Closed, so it stays
-- editable all day. One row per (League, athlete number), kept apart from
-- the run check-in so an athlete can be checked in to both. The key is the
-- entry's, so an athlete has to be entered in the League; the swim heat
-- need not match their swim slot.
create table swim_call_room_check_in (
  league_id integer not null,
  athlete_no integer not null,
  swim_heat integer not null check (swim_heat > 0),
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid,
  primary key (league_id, athlete_no),
  foreign key (league_id, athlete_no) references entry (league_id, athlete_no)
    on delete cascade
);

alter table swim_call_room_check_in enable row level security;

create trigger swim_call_room_check_in_stamp
  before insert or update on swim_call_room_check_in
  for each row execute function private.stamp_check_in();

create policy "Team members can read their leagues' swim check-ins"
  on swim_call_room_check_in for select
  to authenticated
  using (private.has_league_role(league_id));

create policy "Callers can check in athletes to swim heats"
  on swim_call_room_check_in for insert
  to authenticated
  with check (private.has_league_role(league_id, 'caller'));

create policy "Callers can move swim check-ins between swim heats"
  on swim_call_room_check_in for update
  to authenticated
  using (private.has_league_role(league_id, 'caller'))
  with check (private.has_league_role(league_id, 'caller'));

create policy "Callers can undo swim check-ins"
  on swim_call_room_check_in for delete
  to authenticated
  using (private.has_league_role(league_id, 'caller'));

-- Callers see each other's swim check-ins live.
alter publication supabase_realtime add table swim_call_room_check_in;
