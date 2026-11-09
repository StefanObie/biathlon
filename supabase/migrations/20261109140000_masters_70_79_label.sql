-- Masters 70+ becomes Masters 70-79 (#93), now that the start list import reads
-- Masters 80+ rows. The 2027 Masters 70 band covers ages 70-79, so "70+"
-- overlapped with Masters 80+ on the results page; it gets the same "from-to"
-- label as the other Masters bands.

update public.points_table
set age_group_label = 'Masters 70-79'
where season_year = 2027
  and age_group_code = 'M70'
  and age_group_label = 'Masters 70+';
