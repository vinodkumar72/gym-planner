# Implementation plan

1. **Foundation**: Expo SDK 58 project, strict TS, Expo Router, Drizzle schema + migration, seed (exercises, routines), theme, common components, onboarding.
2. **Workout management**: repositories, routine builder, exercise library, active workout with write-through autosave and resume.
3. **Smart engine**: rotation + calendar recommendations, readiness check-in, double progression, recommendation history.
4. **History & progress**: calendar, session detail, charts, PRs, consistency.
5. **Reliability**: backup/restore (JSON, optional passphrase), CSV export, local notifications, settings, tests, docs.

Each phase ends with `npm run typecheck`, `npm run lint`, `npm test`.
