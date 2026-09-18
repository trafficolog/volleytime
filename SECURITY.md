# Security Policy

## Supported release line

The actively reviewed pre-1.0 line is the latest `v0.1.x` release candidate. Older patch releases may contain findings already fixed by later hardening work.

## Reporting a vulnerability

Do not publish credentials, tokens, personal data or a working exploit in a public issue. Report security findings privately to the repository owner/maintainer through a private channel available in GitHub/account contacts.

Include:

- affected commit/release and component;
- reproduction steps with non-production/test data;
- expected vs actual behavior;
- impact and prerequisites;
- suggested mitigation if known.

## Security boundaries relevant to review

High-risk areas that require explicit regression coverage are:

- Telegram `initData` validation and session/account linking;
- organization tenant isolation and role escalation;
- invite/moderation permissions;
- booking/subscription/payment atomicity and refunds;
- internal bot endpoints and webhook secrets;
- trusted-proxy/rate-limit handling;
- production secrets and `.env` handling;
- migrations, backup/restore, smoke and rollback behavior.

Repository tests do not substitute for manual Telegram QA or production operational verification.
