# Academy Management — reviewed release

React/Vite frontend, Express/Mongoose API, MongoDB Atlas database, and independent database backups. Existing admin/staff workflows are preserved: sessions, classes/sections, subjects, designations, staff credentials and teacher assignments, students/guardians/enrollment, fees/payments/waivers, tests/results/amendments, salaries/expenses, notifications and reports.

See `PROGRESS.md` for measured validation results and remaining limitations. See `backup/README.md` for recovery and scheduling. Keep real `.env` files, test databases, logs and backup archives out of Git.

## Requirements

- Node.js 22.12 or newer and npm. This review ran on Windows with Node 26.3.1; use a supported Node release on your deployment host and repeat the checks there.
- MongoDB Atlas or a local **replica set**. Transactions are required; a standalone local `mongod` is insufficient.
- MongoDB Database Tools for backups; rclone for optional cloud upload.

## Initial setup

Extract the complete ZIP. Keep `client`, `server`, `backup` and `scripts` beside one another. Run these commands from the extracted project root:

```powershell
npm --prefix server ci
npm --prefix client ci
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
Copy-Item backup/.env.example backup/.env
```

Do not overwrite existing private settings when upgrading; merge the example settings into them. The original upload included a credential-bearing database URI and JWT secret. They are not redistributed. Rotate credentials that were shared, then enter replacement values privately on the intended host.

Edit `server/.env`:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.example.mongodb.net/test?retryWrites=true&w=majority
JWT_SECRET=GENERATE_A_UNIQUE_RANDOM_VALUE
JWT_EXPIRES_IN=7d
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=CHOOSE_A_UNIQUE_STRONG_PASSWORD
```

Generate a JWT secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never commit it. Percent-encode reserved characters in the Atlas username/password. Keep the actual existing database path (`test` in the supplied conversation). Configure the same database in `backup/.env` with `BACKUP_DB=test`. Keep `client/.env` as `VITE_API_URL=/api`.

`server/.env` loads relative to its source file, not the current terminal directory. DNS uses the operating system's configuration; only set `DNS_SERVERS` to a comma-separated list if your network administrator requires a specific resolver. No public DNS override is forced. `TRUST_PROXY` defaults to disabled; set it only for the actual number of trusted reverse-proxy hops, with direct untrusted access to the API blocked.

Prepare database indexes before first use or an upgrade. For an existing database, first take and verify a backup, pause application writes, and review the preview:

```powershell
npm --prefix server run db:prepare -- --confirm-db test
npm --prefix server run db:prepare -- --confirm-db test --apply
```

This creates required indexes and replaces the known legacy `expenses.sourceSalaryPayment_1` sparse unique index with an ObjectId-only partial unique index. The legacy index incorrectly indexed explicit nulls, preventing multiple manual expenses. The command never drops collections or documents and only removes that precisely identified old index. Existing duplicate salary links or conflicting custom indexes must be reviewed manually; do not delete financial records to force an index to build. Production auto-indexing is disabled so index work occurs during the planned preparation step.

Create the first administrator only if one is needed:

```powershell
npm --prefix server run seed:admin
```

The seed command leaves an existing account unchanged. Supply a strong, unique seed password before running. Admin and staff can change their own passwords under **My account → Change password**. Forgotten admin passwords still require a controlled recovery procedure; an administrator can reset staff passwords through Staff & Teachers.

Start two terminals:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix client run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to port 5000. If you change the API port, also change the proxy in `client/vite.config.js`. Use the same host spelling in the browser and `CLIENT_URL`. Set up a session, classes, sections, subjects and designations before enrolling students or assigning teachers.

## Tests and checks

From the project root:

```powershell
npm --prefix server test
npm --prefix server run check:syntax
npm --prefix server run backup:test
npm --prefix client test
npm --prefix client run lint
npm --prefix client run build
npm --prefix server audit
npm --prefix client audit
```

Backend tests launch an isolated MongoDB replica set with synthetic data; they override the app URI and do not need Atlas credentials. The first run downloads a MongoDB binary (roughly 600 MB on the reviewed Windows setup); later runs reuse its cache. A network-blocked host needs a compatible cached binary or `MONGOMS_SYSTEM_BINARY` set to a local `mongod` executable. Frontend tests use a DOM test environment and mocked API responses. Backup unit tests use temporary files. Local runtime checks and external-account checks are distinguished in `PROGRESS.md`.

Tests must never be redirected to a live academy database. No SMTP/SMS/WhatsApp secrets are required for automated tests. Existing frontend lint warnings are reported in `PROGRESS.md`; an exit code of zero does not mean every style warning has been removed.

## Production deployment

The supported default serves frontend and API on **one HTTPS origin**. This is necessary for the readable CSRF cookie and strict authentication cookie. Do not point the frontend directly at an unrelated API domain and expect these cookies to work.

1. Configure Atlas networking and a restricted application account. Complete the index preparation command against the intended database during maintenance.
2. Build: `npm --prefix server ci`, `npm --prefix client ci`, `npm --prefix client run build`.
3. Keep `client/dist` alongside `server`. Express serves this directory in production and supports browser reloads on client routes. Requests under `/api` stay API requests.
4. Set deployment environment variables: `NODE_ENV=production`, `PORT` as supplied by the host, `CLIENT_URL=https://YOUR_APP_HOST` (origin only, no trailing slash), a private `MONGO_URI`, a strong private `JWT_SECRET`, and correct `TRUST_PROXY` if needed. Never put database or SMTP secrets in `VITE_*` variables; they are public frontend build settings.
5. Start with `npm --prefix server start`. Put it behind the host's HTTPS termination and process supervision. The server connects to MongoDB before listening and handles shutdown signals. Restrict direct access to the backend port.
6. Check `/api/health`, page reloads, admin/staff login, CSRF-protected mutations and role restrictions on the real HTTPS hostname. Verify certificate renewal, logs, restart behavior, host sleep limits and monitoring.

If hosting client and server separately, proxy `/api` through the frontend's origin to Express, forwarding headers/cookies correctly. Keep `VITE_API_URL=/api`. Do not loosen cookie security to compensate for a missing proxy.

Build machines need frontend development dependencies. Runtime can use `npm --prefix server ci --omit=dev` after packaging the built client. Do not publish `server/.env`, `backup/.env`, original uploads, database archives or test logs as static files. No deployment account or hosting service is created by this release.

## Backup, restore and scheduling

Read `backup/README.md`, then configure the private backup environment. From the root:

```powershell
node backup/check-tools.mjs
node backup/backup.mjs
node backup/verify-latest.mjs
node backup/restore.mjs --list
node backup/restore.mjs --file backup/backups/ACTUAL_FILE.archive.gz --target-db academy_restore_test_20260910
node backup/restore.mjs --file backup/backups/ACTUAL_FILE.archive.gz --target-db academy_restore_test_20260910 --execute
```

The restore target must be separate, match the safe test-name pattern, and should be empty. Default is preview; `--execute` is explicit. Existing collections are never dropped. Integrity verification alone does not prove recoverability. Schedule database-scoped dumps while writes are paused to avoid an inconsistent multi-collection snapshot. Keep archive and manifest together. Old unmanifested backups are preserved but require separate review and are not automatically trusted.

After authorizing a dedicated rclone remote, enable cloud upload, test it, and install the optional daily Windows task:

```powershell
powershell -NoProfile -File backup/run-backup.ps1
powershell -NoProfile -File backup/install-scheduled-task.ps1 -At '20:00'
```

The default task runs every day at 8:00 PM on a Windows computer configured for Pakistan Standard Time, under the signed-in user. Configure the task account manually for signed-out operation. For cloud deployment, schedule the same backup at `20:00 Asia/Karachi` or `15:00 UTC`, and write verified archives to durable offsite storage. Protect backup permissions, test offsite recovery and arrange independent failure/freshness alerts.

## Remaining product and operational boundaries

- In-app notifications work for staff. Email requires SMTP credentials and a verified sender. SMS and WhatsApp remain explicit “provider not configured” adapters; integrating a chosen provider requires provider-specific implementation, credentials and testing. They are not falsely reported as delivered.
- Guardian login/portal, attendance, bulk year-end promotion were not implemented in the uploaded repository. Existing enrollment supports new academic-session placements; same-session transfer needs a designed history/migration workflow. These are future features, not silently advertised as finished.
- Notification delivery is synchronous and suitable for modest batches. Atomic claims prevent simultaneous sends of the same row, but exactly-once delivery cannot be guaranteed after an external provider accepts a message and the process crashes. Review stuck `processing` rows/provider logs before manually requeueing. Larger workloads need a durable queue and provider idempotency.
- Financial payment submissions are not idempotency-key based. A client retry after an ambiguous network failure can create another legitimate payment within the remaining balance; inspect the invoice's payment history before retrying. Amounts are PKR, entered to two decimal places; arithmetic uses integer paisa while existing MongoDB/API values remain rupee numbers. Multi-currency and a Decimal128 storage migration are outside this release.
- Existing data can contain historical inconsistencies from earlier versions. Take a backup and inspect your actual records; this release does not rewrite them silently.
- Credentials, cloud authorization, Atlas restore drills, real HTTPS hosting checks, scheduler setup, monitoring and provider delivery are manual external steps.

## Account and financial behavior (follow-up update)

Admin and staff both have a **My account** navigation item. Enter the current password, a different new password of at least 12 characters (maximum 72 UTF-8 bytes), and matching confirmation. Success keeps this browser signed in and invalidates older sessions. Other sessions return to sign-in on their next rejected API request. The endpoint is authenticated, CSRF-protected and rate-limited. No password is logged or returned.

All displayed money is **Pakistani rupees (PKR)**, including staff salaries, fees, dashboards and reports. Two decimal places preserve paisa; CSV financial headers identify PKR and negative adjustments remain numeric. Existing stored numbers are treated as rupees, **not converted using an exchange rate**. If historical data was actually entered in another currency, review it before using this assumption.

Money inputs accept at most two decimal places and up to PKR 1,000,000,000 per value. Addition/subtraction uses integer paisa, with range checks. Invoice and salary forms show their calculated totals before saving.

New tuition invoices and monthly bulk billing use tuition minus discount and scholarship. Admission, exam and other invoice types default to only their respective charge. Use explicit overrides to combine charges or apply a reduction to a one-off invoice; previews show the result. This prevents admission/exam charges from silently recurring each month. Existing invoices are unchanged and must be reviewed separately if earlier billing included unintended charges.

A fully discounted invoice is paid with zero due. A salary with deductions covering its base plus bonuses has zero net pay; marking it paid settles the salary without inventing a zero-value expense. Positive salary payments create exactly one matching expense transactionally.

To reverse a fee payment, open the invoice. For a paid invoice choose **Adjust payment**; otherwise use **Record payment → Adjustment**. Enter a negative PKR amount and an audit note/reference. The server rejects reversals larger than the payments received and keeps the original receipt history. Waived invoices remain closed to payments/adjustments.

## Archive history and admin removal

Admin removal actions archive records instead of permanently deleting them. Confirmation requires the signed-in admin's current password and a reason of 3 to 500 characters. A wrong password makes no changes. Archived records disappear from normal lists, dashboard headcounts, active expense reports and teacher permissions, while MongoDB retains them for audit and recovery.

Archiving a session or class also archives dependent sections, enrollment assignments, teacher assignments, tests and results. Archiving a subject hides related assignments, tests and results. Archiving staff disables linked login access immediately and hides teaching assignments. Archiving a student hides enrollment assignments but preserves invoices, payments and academic history. Expense categories can be archived without deleting past expenses. Salary-generated expenses remain locked to their salary payment and cannot be archived separately.

Admins can open **Archive history** in the sidebar to see the record, reason, admin, date and number of affected documents. Restore also requires the admin password and a reason, and restores only documents owned by that archive operation. Restored academic sessions are not automatically made current; choose the intended current session explicitly.

GitHub stores source code; it does not run the application or create database backups by itself. Once deployed, put the daily backup job on an always-on deployment worker or scheduler at `20:00 Asia/Karachi` (`15:00 UTC`) and upload verified archives to durable offsite storage. The Windows task remains available for an always-on Windows backup host, but it should not be the only backup path when the academy app no longer runs on this laptop.
