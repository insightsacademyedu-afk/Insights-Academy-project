# Academy database backup and recovery

The live database remains in MongoDB Atlas. These scripts are independent of Express and need Node.js 22.12+ and MongoDB Database Tools 100.3+ (`mongodump`, `mongorestore`). Cloud upload additionally needs rclone. Install compatible current tools from [MongoDB](https://www.mongodb.com/try/download/database-tools) and [rclone](https://rclone.org/downloads/).

## Configure

From the extracted project root:

```powershell
Copy-Item backup/.env.example backup/.env
node backup/check-tools.mjs
```

Edit `backup/.env` privately. Use the existing academy database name: the supplied conversation identified it as `test`. Keep both `MONGO_URI=.../test?...` and `BACKUP_DB=test`. A missing database path, disagreement, system database or wildcard is rejected before any database command starts. The dump also explicitly passes `--db=test`. Do not change to an empty database just to obtain a green result. Use a database account with read access only to the academy database for routine backups. Restrict Atlas network access to the backup host.

The `.env` and backup directory contain sensitive data. Restrict their Windows security permissions to the backup account and administrators; use a private folder outside shared/synchronized document locations. On Unix restrict the directory to mode 700 and `.env` to 600. Temporary tool configuration files contain the URI, inherit the directory's access controls, and are deleted after each operation. Credentials are not passed in process arguments or copied into logs. A hard process/machine crash can leave `.connection-*` folders; inspect and remove those after confirming the operation has stopped.

Optional executable settings `MONGODUMP_BIN`, `MONGORESTORE_BIN`, and `RCLONE_BIN` accept absolute paths, including paths with spaces. Environment variables override the file. `BACKUP_DIR` and restore `--file` paths are always relative to the **project root**, regardless of the terminal's working directory; absolute paths also work.

## Back up, verify, list

```powershell
node backup/backup.mjs
node backup/verify-latest.mjs
node backup/restore.mjs --list
```

Equivalent commands from `server`: `npm run backup`, `npm run backup:verify`, `npm run backup:list`, `npm run backup:check`, and `npm run backup:test`.

A successful run writes `academy-test-TIMESTAMP-RANDOM.archive.gz` plus its `.json` manifest. It checks the complete gzip stream, records and verifies SHA-256 and file size, and validates database identity and age. Partial dumps never become completed backups. A directory lock prevents overlapping runs. A leftover `.backup.lock` requires an operator to check the recorded process/host activity before removing it; the script never guesses that a lock is stale.

These are integrity checks, not proof of database recoverability. A dry run and actual test restore are required. A database-scoped `mongodump` is not a point-in-time snapshot across concurrent transactions: schedule during a period when application writes are paused. Stop every app/worker capable of writing, complete the dump, then resume. For uninterrupted production writes, use a suitable managed snapshot strategy instead. This script deliberately does not widen the dump to all databases or add `--oplog` to a scoped backup. See [MongoDB mongodump documentation](https://www.mongodb.com/docs/database-tools/mongodump/).

Old archives from the earlier scripts are preserved. They lack the new manifest and are not automatically trusted, listed, or pruned. Keep them, create a fresh backup with this version, and complete a restore drill before retiring old recovery copies. Do not invent a manifest for an unverified old archive.

## Restore into a separate test database

Copy a filename shown by `--list`. Keep its manifest beside the archive:

```powershell
node backup/restore.mjs --file backup/backups/ACTUAL_FILENAME.archive.gz --target-db academy_restore_test_20260910
node backup/restore.mjs --file backup/backups/ACTUAL_FILENAME.archive.gz --target-db academy_restore_test_20260910 --execute
```

The first command is a preview (`mongorestore --dryRun`). The second writes data. The target must differ from the source (case-insensitively) and end in `_restore_test` or `_restore_test_SUFFIX`. System databases and arbitrary production names are rejected. Only the academy namespace is included, with `--nsFrom=test.* --nsTo=academy_restore_test_20260910.*`. No `--drop` option exists; use a new empty test name for every drill. Restoring into an occupied target can fail on duplicate IDs and leave a partial **test** restore; choose a fresh target before retrying.

For the restore operation, temporarily provide an account authorized to read the source and write only the designated test database. Do not grant routine backup accounts broad write permissions. Using a different URI through the process environment is supported, but its database path must still equal `BACKUP_DB`; remapping happens through namespace options. The application must not be pointed at the test target until you intentionally launch an isolated verification instance.

After execution, compare source/dump-time and test-target collection counts and indexes. Check students/guardians, staff logins, fee invoices/payments, salary expenses and test results using an isolated application instance. No synthetic email/SMS/WhatsApp deliveries should be enabled during a restore drill. Stop test instances afterward. Production recovery is intentionally not automated here; select a proven backup and create a separately reviewed recovery plan rather than bypassing the source-database guard.

Namespace behavior follows [MongoDB mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/).

## Cloud upload and retention

1. Run `rclone config` as the **same Windows account** that runs scheduled backups, and authorize your own storage account. For Google Drive, create a remote named `academy-backups`.
2. Use a dedicated destination: `RCLONE_REMOTE=academy-backups`, `RCLONE_PATH=academy-management`. This version appends `/test` to isolate database-specific retention.
3. Set `UPLOAD_TO_CLOUD=true`; run a manual backup and verify its output and `last-backup-status.json`.

Both archive and manifest are uploaded with `copyto`. `rclone check --one-way --download` checks the uploaded bytes before any cleanup. A failed upload/check exits nonzero and keeps local recovery files. Remote retention deletes only the matching generated filenames older than `CLOUD_RETENTION_DAYS` within that dedicated database folder. Do not put unrelated archives with matching names in it. It never uses `sync` or `purge`. See [rclone check](https://rclone.org/commands/rclone_check/) and [rclone delete](https://rclone.org/commands/rclone_delete/).

Local retention removes old, valid generated archive/manifest pairs for this database only, preserving the newest completed backup. Corrupt/unmanaged files are left for manual review. Retention defaults to 30 days. Cloud provider trash, quotas and version history have separate provider rules. Consider a private rclone crypt remote for encrypted offsite copies; retain the encryption configuration/key separately or recovery becomes impossible.

`verify-latest` checks local integrity and age; inspect `last-backup-status.json` for overall run/cloud success. Monitor scheduler failures and the age of this status file. A backup host that never runs cannot report its own outage; configure an external freshness monitor. No alert service is provisioned by this ZIP.

## Windows daily scheduling

Run and inspect a manual scheduled-style operation first:

```powershell
powershell -NoProfile -File backup/run-backup.ps1
powershell -NoProfile -File backup/install-scheduled-task.ps1 -At '20:00'
Get-ScheduledTaskInfo -TaskName 'Academy Database Backup'
```

The installer creates a daily 8:00 PM task for the current signed-in user with an absolute Node path, hidden runner, no overlapping instances and start-when-available behavior. It verifies that Windows uses the `Pakistan Standard Time` zone, because Task Scheduler uses the computer's local clock. It does not overwrite an existing task. Configure explicit database-tool paths in `.env` if scheduler PATH differs from your terminal. Logs go to `backup/logs/backup-YYYY-MM-DD.log`; archive or remove old logs according to your own policy.

For a deployed Linux server or hosting scheduler, run `node backup/backup.mjs` followed by `node backup/verify-latest.mjs` every day at **20:00 in `Asia/Karachi`**. If the platform only supports UTC schedules, use **15:00 UTC**. Store `backup/.env` values in the host's private secret manager, install MongoDB Database Tools in the backup job image, and use durable/offsite storage; an ephemeral application filesystem is not a recovery destination. The exact scheduler configuration depends on the selected deployment provider.

The default task needs the user signed in. To run while signed out, open Task Scheduler, configure “Run whether user is logged on or not” for the intended account and provide its credentials there. Verify that this account can access Atlas, the backup folder and its rclone configuration. Do not embed a Windows password in scripts. Keep the host awake and connected. Test by running the task in Task Scheduler, then confirm result `0`, a fresh archive/manifest, cloud copy when enabled, and a fresh success status file. Follow the organization's PowerShell execution policy; the installer does not change system policy.

## Credentials and external steps still required

Atlas URI/network allowlist/least-privilege accounts; MongoDB tools installed on the actual backup host; cloud account authorization and quota check; Windows scheduled task/account configuration; a real Atlas backup and restore drill; offsite download recovery drill; independent failure/freshness alerts. Local automated tests cannot prove these external settings.

Backup and restore share the same local lock to prevent retention from removing an archive while restore reads it. Both local and cloud retention settings require whole days of at least 1. Inspect crashed runs before removing a stale lock.
