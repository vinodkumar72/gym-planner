# Workout engine

Two pure modules. Neither touches the DB, React Native or `Date.now()`; everything is passed in.

## 1. `nextWorkout(input): Recommendation` (`src/domain/workout-engine`)

Priority: in-progress session (resume) > no routine > readiness "rest" wrapper > rotation/calendar result.

**Rotation**: next template after the last *completed* session's template (wraps around). No history or a routine
change starts at position 0. Dates are never consulted, so a missed day never skips a workout.

**Calendar**: template assigned to today's weekday. Looks back `missedLookbackDays` (default 3) for a scheduled
template with no completed session on/after that day; if found and different from today's, returns a `choice`
(missed vs scheduled) so the UI asks. Nothing scheduled and nothing missed = rest day. Already done today = rest day.

**Readiness**: tired/sore mark options `intensity: 'reduced'`; rest wraps the result in `rest_day` with `override` so
the user can still train. Readiness never diagnoses anything and never blocks the user.

## 2. `computeProgression(input): ProgressionResult` (`src/domain/progression`)

Double progression. Warm-up sets are ignored. Per session we compute completed working sets, top load, sets at
`maxReps`, `allAtMax` (>= targetSets completed and all at max), `failed` (any set < minReps - 2 or fewer than half
the target sets completed).

| Condition | Action |
|---|---|
| no history | review, start conservatively |
| no working sets | review |
| failed twice in a row | decrease (-10%, floored to increment, clamped to bar weight) |
| failed once, no prior | review |
| failed once, prior OK | maintain |
| all at max, readiness tired/sore/rest | maintain (readiness blocks increase) |
| all at max | increase (+increment, snapped to equipment step) |
| otherwise | maintain |

Bodyweight exercises progress reps, timed exercises progress seconds, cardio returns maintain with a 5-10% suggestion.
Every result carries a `reason` string and a `reasonCode`.

Recommendations are stored in `recommendation_history` when a workout is finished (readiness null) and recomputed
with today's readiness when the next workout starts.
