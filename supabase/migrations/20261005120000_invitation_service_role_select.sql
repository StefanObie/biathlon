-- The Invitation link looks up an open Invitation by its hash with the
-- secret key (service_role). The table never granted service_role anything
-- and relied on default privileges, which a project that doesn't
-- automatically expose new tables doesn't give, so the lookup was denied.
grant select on invitation to service_role;
