ALTER TABLE "public"."athlete"
  DROP COLUMN "first_name";

ALTER TABLE "public"."athlete"
  DROP COLUMN "last_name";

ALTER TABLE "public"."athlete"
  ADD COLUMN "full_name" text NOT NULL;

CREATE POLICY "Authenticated users can manage athletes" ON "public"."athlete"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage entries" ON "public"."entry"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage meets" ON "public"."meet"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read points table" ON "public"."points_table"
  FOR SELECT
  TO "authenticated"
  USING (true);
