# Gym Planner

Offline-first workout tracker for iOS and Android. **Open the app. Know what to train today. Track your workout. Get stronger.**

* 100% offline. No account, no server, no analytics. All data lives in an on-device SQLite database.
* Built-in routines (Full Body, Push/Pull/Legs, Upper/Lower, General Fitness) plus a custom routine builder.
* Deterministic "what should I train today" engine with rotation and calendar scheduling, missed-workout handling and a readiness check-in.
* Rules-based double-progression suggestions with a plain-language reason for every recommendation.
* One-tap set logging, prefilled from last time, autosaved on every change, resumable after a kill.
* History calendar, progress charts, personal records, consistency streaks.
* Versioned JSON backup/restore (optionally passphrase-encrypted), local reminders.

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript (strict) · Expo Router · Expo SQLite + Drizzle ORM · Zustand · Zod · react-native-svg · Lucide icons · Jest + React Native Testing Library.

See `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/WORKOUT_ENGINE.md` and `docs/PROGRESS.md`.

## Getting started

```bash
npm install
npm start            # Expo dev server; scan the QR code with Expo Go, or press a / i
```

### Android

```bash
npm run android      # builds a development build and installs it on a connected device/emulator
```
Requires Android Studio with an SDK, an emulator (AVD) or a USB-debugging device. Expo Go also works for development: `npm start`, then press `a`.

### iOS

```bash
npm run ios          # requires macOS with Xcode
```
Or use Expo Go on a physical iPhone via `npm start`.

### Tests, types and lint

```bash
npm test             # Jest: engine, database (in-memory SQLite), services, components
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

### Database migrations

Edit `src/db/schema.ts`, then:

```bash
npm run db:generate  # drizzle-kit writes drizzle/XXXX.sql + updates drizzle/migrations.js
```
Migrations are applied automatically at app start (and in tests). Never edit a shipped migration.

### Release builds (EAS)

The project is linked to the EAS project `@vinodchauhan72/gym-planner`; profiles live in `eas.json`.

```bash
eas login                                   # once
eas build --platform ios --profile production   # cloud build; prompts for Apple ID + creates certs/profiles
eas submit --platform ios --latest          # uploads the build to App Store Connect / TestFlight
eas build --platform android --profile production   # .aab for Google Play
```

The production profile auto-increments the iOS build number on EAS (`appVersionSource: remote`).
Bump `expo.version` in `app.json` for each new marketing version.

Local alternative (requires macOS/Xcode or Android Studio): `npx expo prebuild`, then archive in Xcode
or run `cd android && ./gradlew bundleRelease`.

## Project layout

```
app/            Expo Router screens (tabs: Today, Routines, History, Progress, Settings)
src/domain/     pure engines: workout-engine (next workout), progression (double progression), analytics
src/db/         Drizzle schema, repositories, seed data
src/services/   workout/routine/history/backup/notification services (transactions live here)
src/stores/     Zustand stores (app preferences, active workout with write-through autosave)
src/components/ design system + workout/chart components
drizzle/        generated SQL migrations
tests/          Jest suites
```
