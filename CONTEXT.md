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
An Admin's offer by email for someone to become a Member of an Organization, optionally also naming a Role on the Default team or on one League's team. A user who signs up without one creates their own Organization and becomes its Admin. An Invitation names at most one Role, lasts 7 days, and an Admin can cancel it. An email has at most one open Invitation per Organization: sending again replaces it, and an email that is already a Member can't be invited.
_Avoid_: Invite code (the old shared signup code, which Organizations replace)

**Invitation link**:
The link in an Invitation email. Following it confirms the invitee's email, signs them in and accepts the Invitation in one step, with no Sign-in OTP. It works once, and only for someone who isn't already signed in as a different user.
_Avoid_: Magic link, invite code

**Sign-in OTP**:
The one-time 6-digit code emailed to a user so they can sign in. Signing up and signing in send the same email.
_Avoid_: Login code, invite code, magic link

**Athlete number**:
The number that identifies an athlete within an Organization. For biathlon it is the national number, but an Organization may use any numbering.
_Avoid_: Bib number, licence number

**Role**:
What a Member may do. Roles form a hierarchy: Admin covers Official, and Official covers Timekeeper, Placer and Caller. A Member can hold more than one Role.

**Admin**:
A Member who runs an Organization: creates its Leagues, invites Members and manages its teams. Admin is held on the Organization and covers every one of its Leagues.

**Official**:
A Member who reconciles, closes and reopens heats, imports start lists and exports results for a League. An Official can also use both capture screens.

**Timekeeper**:
A Member who uses a League's Timer screen.

**Placer**:
A Member who uses a League's Position screen, scanning each finisher's bib in finishing order.
_Avoid_: Marshal, scanner, recorder

**Caller**:
A Member who uses a League's Call room screen, checking in the athletes of each heat before it runs.
_Avoid_: Marshal, steward, call room judge

**League team**:
The Members assigned to a League and the Roles each one holds there. A Member has no access to a League unless they are on its team.
_Avoid_: Crew, staff, volunteers

**Default team**:
An Organization's standard League team, copied onto a League when it is created. Later changes to the Default team do not reach existing Leagues.

**Visibility**:
Who can see a League's published results without signing in: Public (anyone), Protected (anyone holding the Results link) or Private (no one). It never grants access to operational data.
_Avoid_: Privacy, sharing

**Results slug**:
The part of a League's results address that identifies it. Public Leagues have a readable slug an Admin can change, which starts as the Organization and League names hyphenated. Protected Leagues have a random slug, which is the Results link. Private Leagues have none. No two Leagues ever share a slug.
_Avoid_: Permalink, handle

**Results link**:
The unguessable link that shows a Protected League's results. An Admin can regenerate it, and the old link then stops working.
_Avoid_: Share link, secret URL

**Featured league**:
The Public League with the latest date on or before today, across all Organizations, shown on the home page with a link to its results. When no League qualifies, nothing is featured.
_Avoid_: Current league, latest league

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
The state a heat enters when an official saves its reconciliation. A closed heat accepts no new captures, and its results are official and published. A swim time has no Closed state and is published as soon as it is recorded and ok. An official can reopen it, giving a reason.
_Avoid_: Published, finalised, reconciled, locked

**Finisher**:
An athlete who crossed the finish line in a heat, whether or not they have been identified yet.

**Call room**:
The holding area where a heat's athletes gather before they run. It is used only for run heats.
_Avoid_: Marshalling area, holding pen

**Check in**:
To record that an athlete has reported to the Call room for a heat. An athlete is Checked in or Not checked in, and a Caller can undo a check-in. An athlete is checked in to at most one heat per League, so checking them in at another heat moves the check-in. Checking in is advice for reconciliation: it never sets a result, and checking in at another heat never changes the heat roster.
_Avoid_: Present, absent, called, missing (as a state)

**Race day screens**:
The screens used while a League is running: Position, Call room, Timer and Reconcile. They are the League's home.
_Avoid_: Capture screens (which exclude Call room and Reconcile)

**League setup**:
The screens that prepare a League or finish it off, kept apart from the Race day screens: Start list, League team and Visibility before the race, and Swim import and Export after it.
_Avoid_: Settings, admin

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

**Call room screen**:
The screen where the Caller checks in a heat's athletes by scanning their bibs or entering athlete numbers. Check-ins are not Captures, and it is not a Capture screen.
_Avoid_: Check-in page, roll call

**Capture screens**:
The Timer screen and the Position screen together. They do not include reconciliation or the Call room screen.

**Points**:
An athlete's score from a run and a swim: 1000 at the age group's base time, plus or minus a rate for every second faster or slower, per gender and age group. The run and swim components are shown separately and the total adds whichever exist. Age bonus points are not included, so Points are not official SA Biathlon points.
_Avoid_: Score (when you mean one component)

**Unclassified**:
The group on a League's results for athletes whose age group and gender have no row in the points table. They show their times but no Points and no rank.

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
