-- An Organization's Swim folder (#71): the Google Drive folder it shares
-- with the app's service account, holding one League folder per League.
-- One service account reads every Organization's folder (ADR 0005), so no
-- two Organizations may register the same one.
create table public.swim_folder (
  organization_id integer primary key references public.organization (id) on delete cascade,
  drive_folder_id text not null unique check (drive_folder_id ~ '^[A-Za-z0-9_-]+$')
);

alter table public.swim_folder enable row level security;

-- Read by those who fetch from it, not every Member: the link is all that
-- ties the folder to the Organization (ADR 0005).
create policy "Officials can read their organization's swim folder"
  on public.swim_folder for select
  to authenticated
  using (private.has_org_role(organization_id, 'official'));

create policy "Admins can set their organization's swim folder"
  on public.swim_folder for insert
  to authenticated
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can change their organization's swim folder"
  on public.swim_folder for update
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true))
  with check (private.is_org_member(organization_id, as_admin => true));

create policy "Admins can remove their organization's swim folder"
  on public.swim_folder for delete
  to authenticated
  using (private.is_org_member(organization_id, as_admin => true));

-- A League's League folder (#71), remembered by id once found by name or
-- picked by an Official, so renaming the folder later doesn't lose it. The
-- app checks it sits in the Swim folder before reading it.
create table public.league_folder (
  league_id integer primary key references public.league (id) on delete cascade,
  drive_folder_id text not null check (drive_folder_id ~ '^[A-Za-z0-9_-]+$')
);

alter table public.league_folder enable row level security;

create policy "Officials can manage their leagues' league folder"
  on public.league_folder for all
  to authenticated
  using (private.has_league_role(league_id, 'official'))
  with check (private.has_league_role(league_id, 'official'));
