# Progress

_Last updated: 2026-10-18_

## Completed

### Phase 1 — Foundation
- Expo SDK 57 project (React Native 0.86, React 19.2; downgraded from SDK 58 to match the installed Expo Go), strict TypeScript, Expo Router, ESLint, Prettier, Jest (two projects: `node` for engines/DB/services, `ui` for components).
- Drizzle schema (`src/db/schema.ts`), generated migration `drizzle/0000_*.sql`, bundled via babel inline-import, applied at startup with `useMigrations`.
- Idempotent seed: 90 built-in exercises across all 11 muscle groups, 4 built-in routines (Full Body, PPL, Upper/Lower, General Fitness) with 13 templates.
- Theme tokens (light/dark), `ThemeProvider`, design-system components (Text, Button, Card, Screen, Stepper, ListRow, EmptyState, Chip, Sheet, Field, Section).
- Onboarding (goal → experience → days → equipment → units → routine with recommendation), writes preferences and activates the routine.
- App icon, adaptive icon, splash, favicon and notification icon generated from the brand artwork (`assets/brand/icon-source.jpg`) by `scripts/make-brand-assets.ps1`.

### Phase 2 — Workout management
- Repositories for exercises, routines/templates/schedule, sessions/sets/recommendations, preferences/meta.
- Routine screens: list (active/archived), detail (activate, rename, duplicate, archive, delete, rotation vs calendar with weekday assignment, reorder templates), template editor (add/remove/reorder exercises, sets, rep range, rest, increment, timed/cardio targets).
- Exercise library with search + muscle/equipment filters, exercise detail with PRs, custom exercise creation, archive.
- Active workout: prefilled sets, one-tap completion, steppers, add/remove sets, warm-up sets, skip/undo, substitute, notes, rest timer (timestamp-based, survives background/kill), discard, finish → summary.
- `workoutStore` write-through persistence with a serial write queue and debounced notes; resume on launch.

### Phase 3 — Smart engine
- `nextWorkout` (rotation, calendar, missed-workout choice, resume, readiness) — 25 tests.
- `computeProgression` (double progression, warm-up exclusion, readiness gating, failure handling, min load, unit conversion/snapping, bodyweight/timed/cardio) — 33 tests.
- Recommendations stored in `recommendation_history` on finish; recomputed with today's readiness when starting; shown on the workout screen and summary.
- Today screen: readiness check-in, recommendation card(s), estimated duration, muscle groups, resume, train-something-else override, last workout, weekly snapshot.

### Phase 4 — History & analytics
- History calendar + recent list, session detail (sets, notes edit, delete).
- Progress: totals, streaks, workouts/week and volume/week bar charts, sets by muscle group, per-exercise trend (top weight / est. 1RM / volume) and PRs on react-native-svg charts.

### Phase 5 — Reliability
- Backup: versioned JSON envelope validated with Zod (drizzle-zod row schemas), preview, confirmation, transactional restore, newer-version rejection, upgrader hook for older versions, CSV export, optional AES-256-GCM + scrypt passphrase encryption (@noble, pure JS).
- Local notifications: weekly reminders on training days, optional rest-day reminder, rest-timer alert; permission requested only when enabled.
- Settings: units, training days, default rest, theme, reminders, backup, privacy page, typed-confirmation delete-all.

## Tests performed
- `npm test` — 11 suites, 91 tests passing. Node: engines (58), migrations, seed, DB integrity (FK restrict/cascade, 2,000-session performance), services (start/finish/resume/substitute/history integrity), store autosave + restart, backup round-trip/transactional failure/CSV/encryption. UI (jest-expo + RNTL): SetRow (one-tap completion, steppers, timed), Onboarding flow.
- `npm run typecheck` — clean.
- `npm run lint` — 0 errors.
- `npx expo export --platform android` — succeeds (7.1 MB Hermes bundle), confirming Metro resolves every import including the inlined SQL migrations.

## Not verified (no emulator/device in this environment)
- No Android AVD exists on this machine and `cmdline-tools` are not installed, so the app was not launched on an emulator. iOS cannot be built on Windows.
- Therefore the following are implemented and unit-tested at the service level but not exercised on a device: Expo Go/device rendering, native share sheet and document picker, local notification delivery, SQLite WAL on device, performance on hardware.

## Known issues / limitations
- Only one routine can be active at a time (by design, MVP).
- Set reordering within an exercise and drag-and-drop reordering are not implemented (up/down buttons are used for templates/exercises).
- Rest timer notification only fires when reminders are enabled in Settings.
- Backup `upgraders` map is empty because there is a single schema version so far; a test should be added whenever a second migration lands.

## Release setup (2026-10-19)
- Project linked to EAS as `@vinodchauhan72/gym-planner` (project id in `app.json` → `extra.eas.projectId`); `eas.json` has development/preview/production profiles with remote build-number management.
- `expo-doctor`: 21/21 checks pass. iOS and Android JS bundles export cleanly. `react-native-worklets` added (required peer of reanimated for native builds).
- The iOS cloud build itself must be started interactively (`eas build --platform ios --profile production`) because EAS needs an Apple ID sign-in to create the distribution certificate and provisioning profile. A non-interactive attempt stopped at exactly that step, with no other errors.

## Remaining work
- Device validation on Android and iOS (see above) and screenshots.
- EAS/production signing configuration.
- Optional: haptics on set completion, drag-to-reorder, per-exercise rest overrides during a workout, RPE/RIR entry UI (columns exist in the schema).
