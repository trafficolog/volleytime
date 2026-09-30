# R0.6 pilot UI fixes

## Global Constraints

Separate task branches, SDD before code, RED → GREEN → refactor; no API/domain/schema changes. Five gates per code task, PostgreSQL integration, independent scoped task review, exact-head CI before merge. No production edits from implementation workers. Preserve keyboard focus and neutral shadows. Production remains candidate until post-deploy Telegram/pilot acceptance.

## Task 1: 8.10.7 event status

Read docs/tasks/8-10-7-organizer-event-status-reflow.md. Reproduce mobile pill overflow; fix full text reflow and run task criteria/gates. Files primarily OrganizerEventRow.vue and its tests.

## Task 2: 3.11.11 blue shadows

Read docs/tasks/3-11-11-remove-blue-decorative-shadows.md. Audit global/local decorative shadows; remove blue elevation, preserve focus rings. Files CSS tokens/main/landing and CSS tests.

## Task 3: 3.11.12 native radio

Read docs/tasks/3-11-12-branded-native-radio.md. Native 20px brand radio, labeled grouping keyboard semantics; CSS and two settings pages, tests.

## Task 4: 3.11.13 gray surface fields

Read docs/tasks/3-11-13-fields-on-gray-surfaces.md. Contextual field contrast only gray containers, cover shared and local field classes without changing outside fields. CSS/shared forms tests and browser matrix.

## Task 5: 8.10.8 event filters

Read docs/tasks/8-10-8-stable-event-period-filters.md. Deferred request RED; stable header/filter geometry, no stale rows. Events index and mounted tests.

## Integration

Review each task before next. Tasks 2–4 share CSS: execute serially, retain prior rules/tests. Complete five gates and whole-branch review after integration; release deployment remains controlled runbook with backup, exact SHA and runtime smoke, then real Telegram confirmation.
