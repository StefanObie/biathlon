-- The Medals screen failed to load (#94): "permission denied for table
-- medal_presentation". Like invitation (20261005120000), these tables never
-- granted their roles anything and relied on default privileges, which a
-- project that doesn't automatically expose new tables doesn't give. RLS
-- still decides which rows; these grants only let the policies run.
grant select, insert, update, delete on medal_presentation to authenticated;

-- The League folder (#71) was never remembered for the same reason; the app
-- only logged the error and found the folder by name every time.
grant select, insert, update, delete on league_folder to authenticated;
