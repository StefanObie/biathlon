# Biathlon race-day results system — project overview

**26 August 2026**

---

## The problem this solves

Finishing position next to the athlete numbers are written down by hand at the finish line today. Run times come from a CSV file produced by a timing app. Manual stopwatch time is also written down by hand as a backup, but the CSV is what's generally used. Afterwards, someone sits and combines the written positions with the CSV run times. With a large number of athletes, this process can be slow.

This project aims to speed up the running results. Position and time get captured live as athletes finish and checked against each other automatically. An official corrects any discrepancies and approves the result. The system will also handle the swim-time matching and final results export, built on top of the existing swim timing file.

No new equipment to buy. It runs on two phones you already have, plus your usual printer for bibs. Position cards are the ones you already have and use today, this system doesn't print those.

---

## How it will work on the day

Before the league day, athlete lists get imported once, and the system prints bibs with a QR code and the athlete's number clearly printed. Position cards are your existing reusable set, nothing new to print there.

At the finish line, nothing changes from today: athletes run their heat and are handed a position card in order as they cross the line.

At the results table, instead of writing the position on a sheet, the marshal scans the athlete's bib with a phone camera. The app already knows what position it's expecting next, so the marshal just scans whoever's in front of them. Nothing to type, and a Skip button covers anyone who hasn't arrived yet.

Also at the finish line, a second phone has one large button, pressed once per finisher. It vibrates on every press so the timekeeper gets physical confirmation without looking at the screen, and there's a "missed one" button for the moment someone realises they've fumbled a press. Without that button, a single missed press would quietly shift every athlete after it by one position, with no way to tell where it went wrong.

After each heat, the two records (who finished where, and what time they ran) get matched up automatically. If anything doesn't line up, an official reviews it on screen before it's finalised. Nothing goes out to the public or into the results until someone has actively confirmed it.

Swim times already come from your existing swim timing system. The app reads that file automatically and matches each swimmer to their run time using their athlete number.

The final output is one combined file per athlete with their swim time and run time, in the XML format that the national body requires.

---

## What this doesn't change

- The finish-line chute process stays exactly as it is today.
- Nobody needs to learn a new way of running a heat.
- Operating either phone takes about two minutes of explanation. Each screen does one thing and nothing else.

---

## What's being left out for now, on purpose

Two things are out of scope for the first version, and it's a choice, not a difficulty.

Public results display and points calculation in general are low priority right now, and there's no existing website to plug into. When it does get built, it'll live inside this same system rather than as a separate project.

Age-based bonus points need exact age, which isn't part of the athlete data we receive. So for now the system calculates points from running and swimming performance only, with a clear note that bonus points aren't included and the total isn't an official score. This only affects athletes 28 and older. If date of birth becomes available later, adding it back in is a small change, not a rebuild.

---

## Rollout plan

1. Printed bibs, generated automatically from your athlete list.
2. The finish-line timer and results-table scanning, plus the screen officials use to check and correct results.
3. Automatic matching with your swim times, and the final results file.
4. Final polish and a full rehearsal.
5. Points calculation and public results display, once earlier stages are proven.

Before this replaces your current process at a real event, we'll run it side by side with your existing paper method at one league event, capturing results both ways and comparing them.

---

## If something goes wrong on the day

- Paper capture sheets stay in every heat bag as a backup. Any heat can be completed by hand if needed.
- A spare stopwatch at the finish line.
- The position cards remain a paper record of finishing order, exactly as they are today.

---

## Bottom line

Low technical risk and no equipment expenses. The finish-line timekeeper role is the one place worth being careful: a missed press is the only error that can affect a whole heat, which is why that screen gets the most attention in the design. Start with the bib printing since it's useful on its own from day one, then build toward the shadow-run test.
