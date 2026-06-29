# Calendar Copilot

Turn dates and times from Gmail messages into Google Calendar events after your approval.

## Stack

- Next.js App Router (web UI + API routes)
- Tauri v2 (desktop shell, macOS-first)
- Rust background watcher (Gmail polling + local persistence)
- Google Gmail + Google Calendar APIs

## What This MVP Does

- Desktop shell + web UI
- Background watcher polling Gmail
- Rule-based scheduling extraction
- Candidate approval queue (`Create Event`, `Edit`, `Ignore`)
- Google Calendar creation only after explicit user action
- Duplicate protection (source message ID + title/start-time similarity)

## Prerequisites

- Node.js 20+
- Rust/Cargo + Tauri prerequisites for desktop:
  - `xcode-select --install` on macOS
  - [Tauri v2 setup docs](https://tauri.app/start/prerequisites/)

## Run Commands

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Validate quality:

```bash
npm run lint
npm run build
npm run validate:extraction
```

4. Start web app:

```bash
npm run dev
```

5. Start desktop app:

```bash
npm run dev:desktop
```

6. Build desktop app:

```bash
npm run build:desktop
npm run package:mac
```

## Environment Variables

- `.env.example` includes runtime defaults and API-side values.
- Desktop release/signing/updater placeholders live in `.env.desktop.example`.
- No secrets are hardcoded.

## OAuth Scopes Used

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.events`

## Integrations

- Gmail: active
- Slack: coming soon (stub)
- Discord: coming soon (stub)

## Additional Docs

- `INSTALLABLE_MVP.md` — installability status and remaining gaps
- `DEMO_SCRIPT.md` — 60-second live demo flow
- `RELEASE_CHECKLIST.md` — release hardening checklist
