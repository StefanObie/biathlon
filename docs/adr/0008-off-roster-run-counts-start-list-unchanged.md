# An Off-roster run counts; the Start list stays as entered

On race day athletes regularly run in a heat other than the one their Start list entry gives them. The export used to take a run time only from the athlete's roster heat, while the public results took it from any Closed heat, so the two disagreed and the export sent SA Biathlon no run time for these athletes. We decided an Off-roster run is a real Run result that counts everywhere, and that the athlete's Start list entry keeps the heat they were entered in: the Start list is the plan, and Run results are what happened.

## Considered options

- **Saving a Reconciliation moves the athlete's Start list entry to that heat.** Rejected: reconciling would silently rewrite the Start list, losing the original assignment, and an athlete whose time is in two heats would flip between them with each save.
- **Keep the export strict and give Officials a "move athlete to heat" action.** Rejected: running in another heat is normal, so this adds a race-day step that is easy to forget, and forgetting it loses a time from the submission.

## Consequences

- When an athlete has Run results in more than one Closed heat, one rule picks the one that counts: an ok Run result beats one that isn't ok (DNS, DNF, DQ), then the roster heat, then the lowest-numbered heat. The public results, the Medals screen and the export all use it.
- An athlete whose roster heat is open but who has a Run result in a Closed heat is exported with that result. Only an athlete with no Run result in a Closed heat is counted as left out because their heat is open (ADR 0001).
- The export preview marks an exported Off-roster run with the heat it came from and lists any other Closed heats the athlete has Run results in, so an Official can catch a Reconciliation mistake before submitting.
- A run time can change after export when the athlete's roster heat closes later with an ok Run result.
