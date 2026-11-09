-- Every table now grants authenticated each command its policies allow,
-- explicitly (#94). These tables relied on default privileges; production
-- already has every one of these grants, so this changes nothing there. It
-- keeps a project with no default privileges working, and lets
-- scripts/check-grants.mjs hold core.sql to the rule.

grant select, delete on athlete to authenticated;
grant select on organization to authenticated;
grant select on organization_member to authenticated;
grant select, insert, update, delete on league to authenticated;
grant select, insert, update, delete on entry to authenticated;
grant select, insert, update on league_team_member to authenticated;
grant select, insert, delete on default_team_member to authenticated;
grant select on points_table to authenticated;
grant select on reconciliation_row to authenticated;
grant select, insert, update on position_capture to authenticated;
grant select, insert, update on time_capture to authenticated;
grant select, insert, update, delete on league_race to authenticated;
grant select on run_result to authenticated;
grant select, insert on audit_log to authenticated;
grant select, insert, update, delete on swim_result to authenticated;
grant select, insert, update, delete on swim_folder to authenticated;
grant select, insert on operator_note to authenticated;
grant select, insert, update, delete on call_room_check_in to authenticated;
grant select, insert, update, delete on swim_call_room_check_in to authenticated;
