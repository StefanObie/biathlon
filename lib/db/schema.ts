import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

export const genderEnum = pgEnum("gender", ["M", "F"]);

export const athlete = pgTable("athlete", {
  athleteNo: integer("athlete_no").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  gender: genderEnum("gender").notNull(),
});

export const meet = pgTable("meet", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  meetDate: text("meet_date").notNull(),
  season: integer("season").notNull(),
});

export const entry = pgTable(
  "entry",
  {
    meetId: integer("meet_id")
      .notNull()
      .references(() => meet.id),
    athleteNo: integer("athlete_no")
      .notNull()
      .references(() => athlete.athleteNo),
    runHeat: integer("run_heat").notNull(),
    swimHeat: integer("swim_heat").notNull(),
    swimLane: integer("swim_lane").notNull(),
    // From SA Biathlon classification, imported directly — not a real FK,
    // see points_table below (its key includes effective_from/gender).
    ageGroupCode: text("age_group_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.meetId, table.athleteNo] })],
);

export const pointsTable = pgTable(
  "points_table",
  {
    effectiveFrom: text("effective_from").notNull(),
    gender: genderEnum("gender").notNull(),
    ageGroupCode: text("age_group_code").notNull(),
    ageGroupLabel: text("age_group_label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ageFrom: integer("age_from").notNull(),
    ageTo: integer("age_to").notNull(),
    runDistanceM: integer("run_distance_m").notNull(),
    runBaseTime: text("run_base_time").notNull(),
    runPointsPerSecond: numeric("run_points_per_second").notNull(),
    swimDistanceM: integer("swim_distance_m").notNull(),
    swimBaseTime: text("swim_base_time").notNull(),
    swimPointsPerSecond: numeric("swim_points_per_second").notNull(),
    // Stored, not applied — see spec 6.3 (masters bonus deferred).
    bonusPointsPerYear: numeric("bonus_points_per_year").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.effectiveFrom, table.gender, table.ageGroupCode],
    }),
  ],
);
