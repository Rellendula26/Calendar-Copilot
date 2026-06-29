# RELEASE_CHECKLIST

## Security and Identity

- [ ] Finalize OAuth consent screen branding and domain ownership
- [ ] Complete Google OAuth app verification process
- [ ] Publish production privacy policy and terms
- [ ] Run security review of token storage and API routes

## Desktop Distribution

- [ ] Configure Apple Developer signing identity
- [ ] Configure notarization credentials (Apple ID, app password, team/provider IDs)
- [ ] Automate notarization and stapling in CI
- [ ] Verify final `.dmg` installs on clean macOS machine

## Update and Reliability

- [ ] Stand up signed updater endpoint/channel
- [ ] Configure staged rollout strategy and rollback process
- [ ] Add production crash reporting for desktop runtime
- [ ] Add production logging/metrics for watcher health and queue actions

## Product Readiness

- [ ] Validate approval-only event creation in all user flows
- [ ] QA duplicate prevention against realistic Gmail threads
- [ ] Validate first-run onboarding clarity with test users
- [ ] Document support runbook for OAuth and desktop install issues
