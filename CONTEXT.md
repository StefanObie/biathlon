# Crossland Biathlon — race-day results

Captures run finishing order and run times live at a league, reconciles them per heat, and merges them with swim times for export.

## Language

### Race structure

**League**:
One race day. It has exactly one session, split into run heats and swim heats.
_Avoid_: Meet, event, race

**Heat**:
A group of at most 20 athletes who run together, identified by its run heat number within a league. Without a qualifier, "heat" always means a run heat.
_Avoid_: Race, wave

**Heat roster**:
The athletes entered to run in a given heat.
_Avoid_: Start list (that's the import file, not the per-heat set)

**Closed**:
The state a heat enters when an official saves its reconciliation. A closed heat accepts no new captures, and its results are official and published. An official can reopen it, giving a reason.
_Avoid_: Published, finalised, reconciled, locked

**Finisher**:
An athlete who crossed the finish line in a heat, whether or not they have been identified yet.

### Capture

**Capture**:
One immutable record from a capture screen: a time press or a position scan. Captures are voided, never edited or deleted.
_Avoid_: Entry, record

**Timer screen**:
The finish-line screen where the timekeeper starts the heat clock and presses once per finisher.
_Avoid_: Time capture page, stopwatch

**Position screen**:
The results-table screen where the marshal scans each finisher's bib in finishing order.
_Avoid_: Scanner, scan page, table capture

**Capture screens**:
The Timer screen and the Position screen together. They do not include reconciliation.

**Missed finish**:
A placeholder time capture recorded when the timekeeper knows they failed to press for a finisher. It marks a finisher with no usable time.
_Avoid_: Missed one, placeholder press

**Skip**:
A position capture with no athlete, recorded when a finisher's bib can't be scanned in order. It marks a finisher whose identity is not yet known.
_Avoid_: Gap (a gap is a reconciliation edit)

**Finished count**:
The number of finishers accounted for on a capture screen, shown against the heat roster size (e.g. 12 / 20). It includes Missed finishes and Skips, and it may exceed the roster size.

**Start offset**:
A heat-level correction for a clock started late: the number of seconds added to every time in the heat.
_Avoid_: Missed start penalty, time adjustment

**Operator note**:
A free-text note an operator adds during capture. It is tied to the point in the heat's sequence at which it was written, and it is kept to help reconciliation correct errors.
_Avoid_: Comment, annotation
