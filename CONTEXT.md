# Crossland Biathlon — race-day results

Captures run finishing order and run times live at a league, reconciles them per heat, and merges them with swim times for export.

## Language

### Organizations and people

**Organization**:
A body or team of people that runs Leagues and manages its own athletes. Every League belongs to exactly one Organization.
_Avoid_: Club, team, tenant, account

**Member**:
A user who belongs to an Organization. A user can be a Member of several Organizations.
_Avoid_: User (when you mean someone inside an Organization), staff

**Invitation**:
An Admin's offer by email for someone to become a Member of an Organization, optionally also naming a Role on the Default team or on one League's team. A user who signs up without one creates their own Organization and becomes its Admin.
_Avoid_: Invite code (the old shared signup code, which Organizations replace)

**Sign-in OTP**:
The one-time 6-digit code emailed to a user so they can sign in. Signing up and signing in send the same email.
_Avoid_: Login code, invite code, magic link

**Athlete number**:
The number that identifies an athlete within an Organization. For biathlon it is the national number, but an Organization may use any numbering.
_Avoid_: Bib number, licence number

**Role**:
What a Member may do. Roles form a hierarchy: Admin covers Official, and Official covers Timekeeper and Placer. A Member can hold more than one Role.

**Admin**:
A Member who runs an Organization: creates its Leagues, invites Members and manages its teams. Admin is held on the Organization and covers every one of its Leagues.

**Official**:
A Member who reconciles, closes and reopens heats, imports start lists and exports results for a League. An Official can also use both capture screens.

**Timekeeper**:
A Member who uses a League's Timer screen.

**Placer**:
A Member who uses a League's Position screen, scanning each finisher's bib in finishing order.
_Avoid_: Marshal, scanner, recorder

**League team**:
The Members assigned to a League and the Roles each one holds there. A Member has no access to a League unless they are on its team.
_Avoid_: Crew, staff, volunteers

**Default team**:
An Organization's standard League team, copied onto a League when it is created. Later changes to the Default team do not reach existing Leagues.

**Visibility**:
Who can see a League's published results without signing in: Public (anyone), Protected (anyone holding the Results link) or Private (no one). It never grants access to operational data.
_Avoid_: Privacy, sharing

**Results link**:
The unguessable link that shows a Protected League's results. An Admin can regenerate it, and the old link then stops working.
_Avoid_: Share link, secret URL

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
The results-table screen where the Placer scans each finisher's bib in finishing order.
_Avoid_: Scanner, scan page, table capture

**Capture screens**:
The Timer screen and the Position screen together. They do not include reconciliation.

**Missed finish**:
A placeholder time capture recorded when the timekeeper knows they failed to press for a finisher. It marks a finisher with no usable time.
_Avoid_: Missed one, placeholder press

**Skip**:
A position capture with no athlete, recorded when a finisher's bib can't be scanned in order. It marks a finisher whose identity is not yet known.
_Avoid_: Gap (a gap is a reconciliation edit)

**Fill**:
Giving a Skip its athlete afterwards on the Position screen, once the Placer can identify them. The Skip is voided and the athlete is captured at the same position, so the positions after it stay as they are. Undoing a Fill turns the position back into a Skip.
_Avoid_: Backfill, edit skip, replace

**Finished count**:
The number of finishers accounted for on a capture screen, shown against the heat roster size (e.g. 12 / 20). It includes Missed finishes and Skips, and it may exceed the roster size.

**Author**:
The Member whose session made a Capture or Operator note. A Capture is accepted if its Author held the Role when they made it, even if it syncs after they've left the League team; the reconcile screen flags it.
_Avoid_: Operator (when you mean who made one particular Capture), owner

**Operator note**:
A free-text note an operator adds during capture. It is tied to the latest capture on its screen when it was written (or to the start of the heat, before the first finisher), and it is kept to help reconciliation correct errors.
_Avoid_: Comment, annotation
