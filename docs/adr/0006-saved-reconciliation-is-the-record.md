# A heat's saved Reconciliation is its record; Captures are evidence

Saving a heat used to store only its Run results. Reconcile then rebuilt the table from the Captures every time it opened, and laid the saved results back over rows by captured athlete. Any fix that wasn't a time or status on a scanned athlete was lost from view: a changed athlete, a row the official added, or a Run result no capture matched. Saving again overwrote the published results with that rebuilt table, and Run results that were no longer on it were never deleted. We now store the Reconciliation itself: each row in order, with its athlete, time, status and the ids of the Captures it came from. Once a heat has been saved, Reconcile opens from that saved Reconciliation, not from the Captures.

The Captures stay immutable. We considered writing an athlete change back onto `position_capture` and rejected it, because the Capture is the only record of what was originally scanned. Where a row's saved athlete or time differs from its Capture, the screen shows both ("Scanned #12 → saved #34").

## Consequences

- A heat's Run results are exactly the athletes in its saved Reconciliation. Saving deletes Run results for athletes no longer on it.
- A Closed heat's Reconciliation is read-only. Changing it, even to add a Late entry, means reopening the heat with a reason (ADR 0001).
- Captures that no saved row came from, such as a late sync or a capture made after a reopen, are listed beside the table, flagged, for the official to place or leave out. The table never changes by itself.
- A saved row whose Capture was later voided keeps its saved values and is flagged. If a Fill replaced that Capture, the replacement is offered.
- Each save writes one audit entry holding the Reconciliation before and after. An athlete change gets no separate audited edit.
- Heats saved before this change have no stored Reconciliation. They open the old way: Captures, with Run results laid over them by athlete, plus a flagged "Saved, no capture" row for each Run result left over. Their next save stores a Reconciliation.
- There are still no drafts. Nothing is stored until Save, and Save closes the heat.
