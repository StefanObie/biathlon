DROP POLICY "Team members can read their leagues" ON "public"."league";

CREATE POLICY "Team members can read their leagues" ON "public"."league"
  FOR SELECT
  TO "authenticated"
  USING ((private.is_org_member(organization_id, as_admin => true) OR private.has_league_role(id)));
