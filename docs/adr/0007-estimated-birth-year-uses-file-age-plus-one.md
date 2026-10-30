# An athlete's birth year is estimated, so age at the end of the season year is file age + 1

The age bonus depends on an athlete's age at the end of the season year, as the Age Group & Points Table defines it. Our only source of ages is a championship entry list, which gives an age and nothing else: no date of birth, and no date the ages were taken. We store `athlete.birth_year = year ages were taken − file age`, so for the 2026 file an athlete's age at the end of 2027 is file age + 1.

The exact birth year can't be known. An athlete whose birthday had not passed when the list was compiled is really file age + 2 at the end of 2027. We checked the three readings against the 158 rows in the sample with an age-limited group. Reading the file age as the age at the end of 2027 puts 80 outside their band, file age + 1 puts 8 outside, and file age + 2 puts 71 outside. All 158 fit once each athlete may be + 1 or + 2. Official results agree: of the 10 Masters athletes in both the entry list and League 1's official results, file age + 1 gives the official bonus for 9, and the other is 5 points too low, which fits a birthday that hadn't passed.

We treat everyone the same way, with file age + 1, because it is consistent and the best fit. We considered asking for full dates of birth and rejected it for now, because no source has them and an age on race day isn't what the Table uses.

## Consequences

- Some athletes are credited one year less than they should be: between 3 and 12 points by age group, which could change a close Medal place. League 1's sample had one such case and no change in medal order.
- Points stay unofficial, and the results page says so.
- `athlete.birth_year` is described as estimated in the schema, so nothing reads it as a real date of birth.
- `points_table.season_year` gives the year the age is counted up to. `league.season` isn't used, because it is typed by hand and may not match the Table's season.
