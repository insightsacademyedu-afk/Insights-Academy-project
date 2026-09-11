# Review and validation — 11 September 2026

This release reviews and fixes the uploaded Academy Management MERN source while retaining its existing modules. The upload did not contain the backup directory described in the prior conversation, so the standalone backup implementation was reconstructed around the explicitly intended existing database, `test`. No live Atlas database was accessed or modified. No real credentials are included.

## Corrections delivered

- Repaired the server dependency lock/qs override mismatch and removed the unused legacy MongoDB driver dependency. Both dependency audits reported zero known vulnerabilities at review time.
- Anchored environment loading to the server directory; removed forced public DNS; disabled proxy trust by default; disabled automatic production index creation; added explicit database preparation and graceful shutdown.
- Added same-origin production SPA serving and development API proxying, lazy page loading and usable fallback navigation. Fixed stale list requests, incomplete large dropdown lists, populated teacher assignments, waived-fee totals, and the archived-session filter.
- Tightened login input/origin handling, JWT algorithm verification, inactive-staff access and transactional staff login creation. Prevented callers from replacing linked login accounts or audit identifiers through generic CRUD.
- Made generic updates run document validation and transactions. Added finite-number checks, reference/session consistency checks and safer deletion guards for related academic and financial records.
- Corrected numeric-string money calculations, payment precision/range validation, waived-invoice handling and excessive reversals. Made related student/guardian and financial updates atomic.
- Fixed manual expenses failing under the legacy nullable sparse unique index; supplied a preview-first, narrowly scoped index preparation command. Serialized changes to the current academic session.
- Restricted teacher test/result access by active academic-session assignments. Validated all mark entries before writes, used atomic batches and prevented mark/finalization races.
- Added atomic notification delivery claims, honest provider failure handling and SMTP timeouts. Protected CSV exports against formula injection and included the full final day in date-only report ranges.
- Rebuilt database-scoped backups with explicit URI/database agreement, SHA-256/size/gzip verification, source manifests, non-overlapping runs, bounded retention, optional verified rclone uploads and Windows scheduling scripts. Restore previews by default, maps only the source namespace to a separate test database, never drops collections, and shares the backup lock during reads. Retention days must be positive integers.
- Replaced destructive admin delete actions with password-confirmed archive operations and an admin-only Archive history screen. Cascades hide dependent academic records, staff archives revoke login access, financial history remains intact, restore actions are audited, and active queries reject archived references.
- Replaced outdated setup documentation, removed build-phase UI text and excluded uploaded secrets from the release.

## Measured checks

| Check | Result |
|---|---|
| Backend Jest integration/regression suite | 12 suites, 100 tests passed |
| Frontend Vitest suite | 13 files, 88 tests passed |
| Backup safety unit tests | 8 passed |
| Production configuration/static/security smoke | 4 passed; no external database connection |
| JavaScript syntax | 101 server/backup/script files passed |
| Frontend production build | Passed; lazy chunks below 500 KB |
| Frontend lint | Passed with zero errors and 12 warnings |
| Server and client npm audit | Zero reported vulnerabilities in each dependency tree |
| Dependency installation | Client npm ci and repaired server npm install passed; final server npm ci dry-run validated lock compatibility |
| PowerShell parsing | Both backup scripts parsed without errors |
| Local HTTP + real MongoDB replica set | Login, setup, enrollment, payments, salary expense, marks/finalization, in-app notification and reports passed |
| Real Database Tools backup/restore | Database-scoped dump, integrity verification, preview with no writes, executed test restore, matching collection counts/indexes and unrelated-database isolation passed |
| Browser checks | Admin/teacher login, logout, session creation, teacher navigation/assignment dropdown and mobile navigation inspected using synthetic local data |

Environment: Windows, Node 26.3.1, MongoDB 7.0.24 and MongoDB Database Tools 100.18.0. Backend tests use an isolated replica set; frontend tests use mocked APIs. The production smoke validates response behavior through Supertest, not a deployed TLS certificate. Browser inspection is a focused flow check, not exhaustive device/accessibility coverage.

Lint warnings retained: ten React synchronous state-in-effect warnings in data-dependent forms, two Fast Refresh export warnings in context modules. They do not block the build; they remain refactoring work. No rule was disabled to disguise them. Two frontend tests initially exceeded the five-second timeout while other checks loaded this Windows host; two workers and a 15-second test timeout produced a complete passing rerun. The runtime smoke now chooses an available port automatically; `--serve` intentionally reserves port 5010 for browser checks.

## Reproduce the additional smoke checks

Run all standard checks listed in README first, including the client build. From the project root:

```powershell
node --test server/tests/productionSmoke.mjs
node server/tests/runtimeSmoke.mjs
```

The runtime smoke requires `mongodump` and `mongorestore` on PATH, or explicit `MONGODUMP_BIN` / `MONGORESTORE_BIN` executable paths. The replica-set binary can be cached or supplied through `MONGOMS_SYSTEM_BINARY`. It creates synthetic data and temporary backups, checks recovery and removes its fixtures on normal completion. Do not modify it to target a live database. Add `--serve` only for a temporary 15-minute synthetic browser fixture at localhost:5010. Its printed fixture password is test-only.

## Required private/external steps

1. Rotate the credential-bearing URI/JWT from the original shared upload, enter private environment values and configure Atlas network access plus least-privilege accounts. Preserve the real academy database name.
2. Back up existing data, pause writes, preview and apply the documented index preparation; resolve historical duplicates or custom-index conflicts manually. Seed an administrator only when needed.
3. Install Database Tools, protect backup folders, choose a quiet backup window, configure and authorize the dedicated rclone remote, and test upload/download recovery with the actual account. No cloud transfer was tested here.
4. Install the Windows task on the intended always-on host; configure signed-out operation if needed and verify task exit codes, freshness alerts and restart behavior. Scripts were parsed, not installed as live scheduled tasks.
5. Deploy behind real HTTPS with the correct same-origin proxy, repeat authentication/CSRF checks, and configure supervision, monitoring and certificate renewal. No hosting account was deployed.
6. Configure SMTP/verified sender and test actual delivery. SMS/WhatsApp provider adapters require implementation for the chosen provider; credentials alone do not enable them.
7. Perform an Atlas restore drill into a fresh test database, compare records and indexes, and document recovery ownership. Local recovery success does not certify current production data or cloud permissions.

## Remaining product limitations

The project has no guardian portal, attendance module, bulk year-end promotion or history-aware same-session transfer workflow. They are not represented as completed features. Financial requests have no idempotency keys: inspect history before retrying an ambiguous submission. Monetary values remain rupee numbers in storage; new arithmetic uses integer paisa and validated two-decimal inputs. No historical-data currency conversion or Decimal128 migration is performed. Notification processing is synchronous; review interrupted `processing` rows before requeueing because external delivery cannot be exactly-once without provider support. Production data may contain older inconsistencies; this release does not silently rewrite it.

This is a tested source release with documented operational prerequisites, not a claim that every possible defect, security issue or deployment-specific behavior has been eliminated.

## User-facing follow-up: passwords, PKR and calculations

Added the My account page for both admin and staff, current-password verification, confirmation/length validation, atomic password replacement and token-version invalidation. Other sessions are rejected and the frontend returns to sign-in when it receives a protected API 401. Wrong passwords, mismatches, reused/short/overlong values and missing CSRF are rejected.

Changed currency displays to PKR with two decimals, including staff salaries. Money entry supports paisa; invoice/salary forms show previews. Financial fields reject sub-paisa or out-of-range entries. Invoice totals, salary totals, payments, reversals and report/summary totals use integer-paisa addition/subtraction. Dashboard aggregate output is normalized to paisa. Negative financial CSV cells stay numeric while text formula injection remains blocked.

Corrected new invoice defaults by type and monthly bulk billing to avoid recurring admission/exam charges; explicit overrides remain available. Zero-net salaries settle without a zero-value expense. Existing historical invoices and monetary values were not rewritten.

Regression tests cover admin/staff password changes, current-session continuity, old-session invalidation, old/new login credentials, input failures, exact 0.10 + 0.20 payments, negative reversals, matching reports/dashboard/student balances, 10,000 one-paisa additions, discounts, salary expenses, zero-net settlement, monetary precision/range and invoice-type defaults. Frontend tests cover both account roles, success/error/mismatch behavior, PKR formatting and session-expiry events.

The local Database Tools backup/preview/restore drill was repeated after these backend changes and passed with matching counts/indexes and unrelated-database isolation. Browser tools reported **No browser is available** during this follow-up; the earlier browser checks above predate these changes. New account and financial form behavior is covered by DOM/API tests, but a visual browser review of the new page and actual production HTTPS behavior remain manual.

Payment UI follow-up: negative adjustments are accepted down to the amount already paid, and paid invoices expose Adjust payment. A DOM regression test verifies a -0.10 PKR adjustment is sent with the adjustment method. Final frontend rerun: 88 tests passed; lint zero errors with existing React warnings; build passed. The unused salary-modal toast and duplicate input step attribute were removed. Currency scan found no remaining USD/dollar-amount references in frontend source.

## User-facing follow-up: archive instead of permanent deletion

Admins can archive sessions, classes, sections, subjects, designations, staff, students, teacher assignments, expense categories and manually entered expenses. Each action requires the current admin password and an audit reason. Archived records are retained in MongoDB, excluded from active lists and relevant dashboard/report counts, and visible in the admin-only Archive history page. Restore requires password confirmation and records its own reason.

Session/class/section/subject archives include dependent academic setup, assignments, tests and results in one transaction. Staff archive disables every linked user session. Student archive preserves invoices and payments, and category archive preserves expenses. Salary-generated expenses cannot be separated from paid salary history. Regression coverage verifies wrong-password rejection, cascade hiding/restoration and preserved financial records.

GitHub alone is not an application host or backup scheduler. When the app moves off this laptop, configure the deployment provider's worker or cron service for `20:00 Asia/Karachi` (`15:00 UTC`) and durable offsite storage. The included Windows task is an alternative only for an always-on Windows backup machine.
