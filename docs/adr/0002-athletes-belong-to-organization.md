# Athletes belong to an Organization, not to the whole system

Athletes are identified by an **Athlete number**, which for biathlon is the national number, so a single system-wide athlete table would look natural. We chose instead to have each Organization own its athletes, keyed by Organization and Athlete number. Anyone can create an Organization, and not every Organization numbers athletes the national way. A shared table would let one Organization's start-list import overwrite another Organization's names or genders, and it would force every Organization onto one numbering scheme. The cost is that someone who races for two Organizations is stored twice, and the two records can drift apart.

## Consequences

- An athlete's results are not linked across Organizations. Showing an athlete's results across Organizations would need an explicit matching step, not a shared key.
