# Architecture

Offline-first gym workout tracker for iOS and Android. No backend, no accounts, no analytics.

## Layers

```
Expo Router screens (app/)
        |
Zustand stores (src/stores)            thin UI state + active-workout mirror
        |
Services (src/services)                orchestrate repositories + engines, own transactions
        |
   +----+-------------------------+
   |                              |
Domain engines (src/domain)   Repositories (src/db/repositories)
pure TypeScript, no RN/DB     Drizzle ORM over Expo SQLite
```

* **Domain engines** (`src/domain/workout-engine`, `src/domain/progression`) are pure functions. They receive typed
  data (routine, sessions, readiness, `now`) and return typed, explainable results. They never import React Native,
  Expo or Drizzle, which makes them unit-testable in a plain Node Jest project.
* **Repositories** wrap Drizzle queries. They are typed against `BaseSQLiteDatabase<'async', any, typeof schema>`
  so the identical code runs on `drizzle-orm/expo-sqlite` in the app and on `drizzle-orm/libsql` (in-memory) in tests.
* **Services** compose repositories and engines, and own multi-table transactions
  (start workout, finish workout, restore backup, duplicate routine).
* **Stores** hold UI state. The active-workout store is write-through: every set mutation is persisted immediately
  through a serial write queue, so an app kill loses nothing that was tapped.
* **Screens** are Expo Router routes under `app/`. They call services/stores and render components from `src/components`.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Expo SDK | 57 (RN 0.86, React 19.2) | matches the Expo Go build installed on the user's phone (downgraded from 58 on request) |
| Database | Expo SQLite + Drizzle ORM | typed schema, generated migrations, offline |
| Migrations | drizzle-kit generated SQL bundled via babel inline-import, applied with `useMigrations` | never destructive, upgrade-safe |
| Charts | custom components on react-native-svg | tiny dependency surface, testable, works in Expo Go |
| IDs | `expo-crypto` UUIDs for user data, stable readable IDs for built-ins | idempotent seeds and backups |
| Weights | stored as entered + `weight_unit` | history shows what was actually lifted |
| Dates | ISO UTC + `local_date` (YYYY-MM-DD) on sessions | calendar/streak queries without timezone math |
| State | Zustand | minimal, selector-friendly |
| Validation | Zod | backup files and forms |

## Privacy

All data lives in the on-device SQLite file. The app contains no network calls and no SDK that phones home.
Backups are explicit, user-initiated files handed to the OS share sheet.
