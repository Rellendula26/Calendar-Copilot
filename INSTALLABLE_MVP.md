# INSTALLABLE_MVP

## What Works (Implemented)

- Installable Tauri shell (`src-tauri`) with macOS-first bundle configuration.
- Next.js web app still runs unchanged for webhook/demo workflows.
- First-run onboarding + setup checklist in dashboard:
  - Google connected
  - Gmail access enabled
  - Calendar access enabled
  - Background watcher enabled
- Dashboard sections:
  - Watcher Status
  - Detected Events
  - Created Events
  - Settings
- Rust background watcher with typed persisted state:
  - watcher enabled
  - polling interval
  - last checked timestamp
  - processed message IDs
  - candidate events
  - created event mappings and records
- Approval queue with explicit user actions only:
  - Create Event
  - Edit
  - Ignore
- Rule-based extraction supports:
  - today / tomorrow / this Friday / next Monday
  - July 15 / 7/15 / 2026-07-15
  - 3pm / 3:30 PM / 14:00 / noon / afternoon
- Duplicate prevention:
  - source message ID
  - title + start time similarity
- OAuth readiness:
  - consent URL generation
  - auth code exchange
  - refresh token storage via OS keychain (`keyring`)
- Added extraction validation script: `npm run validate:extraction`

## What Is Stubbed

- Slack integration: stub (`coming soon`)
- Discord integration: stub (`coming soon`)
- Production auto-update publishing pipeline (endpoint hosting/signing)
- End-to-end OAuth app verification with Google for public multi-user distribution

## Local Run

### Web

```bash
npm install
cp .env.example .env.local
npm run lint
npm run build
npm run validate:extraction
npm run dev
```

### Desktop

```bash
npm run dev:desktop
```

## macOS Build

```bash
npm run build:desktop
npm run package:mac
```

Prerequisites:
- Rust + Cargo (`cargo --version`)
- Xcode command line tools (`xcode-select --install`)
- Tauri prerequisites for v2

## Remaining Signing / Notarization

Scaffolded but **not fully implemented** in this MVP:

- Apple Developer signing identity wiring
- Notarization credentials + notarization upload workflow
- Stapling + validation automation in CI

## Remaining Auto-Update

Not implemented yet:
- Signed update manifest hosting
- Tauri updater endpoint + channels
- Rollout strategy (staged, rollback)

## Remaining Slack / Discord

Not implemented yet:
- API ingestion adapters
- auth/token management
- source-specific message normalization for those platforms
- channel/thread-specific dedupe logic

## Notes

- This MVP is intentionally optimized for reliability and demo readiness, not full release compliance.
- Calendar event creation always requires user approval in the queue.
