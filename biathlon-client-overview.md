# Biathlon Race-Day Results System — Project Overview
 
**26 August 2026**
 
---
 
## The problem this solves
 
Running times are currently written down by hand at the finish, then matched up to swim times afterwards. That's slow, and any mismatch between a written time and the right athlete is hard to catch and even harder to fix once the day is over.
 
This project replaces that with a small phone-based system: times and finishing positions are captured digitally as they happen, checked against each other automatically, and only need a person to step in when something genuinely doesn't add up.
 
**No new equipment to buy.** It runs on two phones you already have, plus your usual printer for bibs and cards.
 
---
 
## How it will work on the day
 
**Before the meet:** athlete lists are imported once, and the system prints bibs (with a QR code and the athlete's number clearly printed) and position cards.
 
**At the finish line:** exactly as it works today — athletes run their heat and are handed a position card in order as they cross the line.
 
**At the results table:** instead of writing the position on a sheet, the marshal scans the athlete's bib with a phone camera. The app already knows what position it's expecting next, so the marshal just scans whoever's in front of them — nothing to type, and a **Skip** button for when someone hasn't arrived yet.
 
**Also at the finish line:** a second phone with one large button, pressed once per finisher. It vibrates on every press so the timekeeper gets a physical confirmation without needing to look at the screen, and it has a **"missed one"** button for the moment someone realises they've fumbled a press — this avoids an entire heat's times quietly shifting by one place.
 
**After each heat:** the two records — who finished where, and what time they ran — are automatically matched up. If anything doesn't line up, an official reviews it on screen before it's finalised. Nothing goes out to the public or into the results until someone has actively confirmed it.
 
**Swim times:** these already come from your existing swim timing system. The system reads that file automatically and matches each swimmer to their run time using their athlete number.
 
**Final output:** one combined file per athlete with their swim time and run time, in the format your national body requires.
 
---
 
## What this doesn't change
 
- The finish-line chute process stays exactly as it is today.
- Nobody needs to learn a new way of running a heat.
- The people operating the phones need about two minutes of explanation each — the screens are designed to do one thing and nothing else.
---
 
## What's being left out for now, on purpose
 
Two things are intentionally out of scope for the first version, both to keep the project focused rather than because they're difficult:
 
**Age-based bonus points.** Your points table gives older age-group athletes bonus points based on exact age, which needs a date of birth. That information isn't currently part of the athlete data we receive, so for now the system will calculate points from running and swimming performance only, with a clear note that bonus points aren't included and the total isn't an official score. This only affects athletes 28 and older. If date of birth becomes available in future, this is a small addition, not a rebuild.
 
**Public results display and points calculation generally.** You mentioned this is low priority for now, and there's no existing website to plug into — so when it is built, it will live inside this same system rather than being a separate project.
 
---
 
## Rollout plan
 
| Stage | What it delivers | Rough timing |
|---|---|---|
| **1** | Printed bibs and position cards, generated automatically from your athlete list | 2–3 weeks |
| **2** | The finish-line timer and results-table scanning, plus the screen officials use to check and correct results | 3–4 weeks |
| **3** | Automatic matching with your swim times, and the final results file | 2 weeks |
| **4** | Final polish and a full rehearsal | 1 week |
| **5** | Points calculation and public results display | later, once earlier stages are proven |
 
**Before this replaces your current process at a real event, we'll run it side by side with your existing paper method at one league event** — capturing results both ways and comparing them. That's the point at which we'll know it's ready to rely on, not before.
 
---
 
## If something goes wrong on the day
 
- Paper capture sheets stay in every heat bag as a backup — any heat can be completed by hand if needed.
- Power banks are recommended for both phones, since the camera uses more battery than normal.
- A spare stopwatch at the finish line costs nothing to keep in the bag.
- The position cards themselves remain a paper record of finishing order, exactly as they are today.
---
 
## What we need from you
 
A short list, nothing blocking the start of the work:
 
1. **Check with your national body (SA Biathlon)** whether there's an official specification for the results file format — the exact layout expected, and what to do for an athlete who's missing one of their two times.
2. **Flag a possible error to whoever maintains the points table** — one row in the worked example in the points document doesn't quite add up (a run time of 2:48.52 should give 996.96 points by the stated formula, but the table shows 988.96). Worth a quick check with them.
3. **A decision on tied running times.** Times are hand-captured to the hundredth of a second, which is finer than a thumb on a button can really guarantee. Worth deciding in advance whether very close times should be treated as a tie, or ranked by whichever was captured first.
4. **A rough idea of mobile signal strength** at the venues you use most. The system is built to keep working through a brief signal drop, but it's better for us to know in advance if a venue is a known dead spot.
---
 
## Bottom line
 
Low technical risk, and no meaningful cost or equipment burden. The main thing worth being careful about is the finish-line timekeeper role, since a missed press is the one place an error could affect a whole heat — which is exactly why that screen gets the most attention in the design. We'd recommend starting with the bib and card printing, since it's useful on its own from day one, and building toward the shadow-run test as the real go/no-go moment.
 
1Password menu is available. Press down arrow to select.