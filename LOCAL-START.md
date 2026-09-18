# Running this local copy

Double-click `start-local.cmd`. The app builds an optimized local copy, starts one server window, and opens `http://127.0.0.1:5000`.

## One-click startup on Windows

Node.js 22.12 or newer, the installed dependencies, and a running local MongoDB are required. VS Code and internet access are not required for normal use.

MongoDB must be configured as the local one-machine replica set `academy-rs` because the app uses transactions to protect related records. This laptop is already configured. For a fresh installation, run `configure-local-mongodb.ps1` once as Administrator.

If Windows blocks the script, right-click it, choose **Properties**, select **Unblock**, and click **Apply**. The script uses PowerShell's temporary execution-policy bypass and does not change the machine policy.

The private `server/.env` must use `mongodb://127.0.0.1:27017/academy_management?replicaSet=academy-rs`. Backups and restore are available to the administrator under **My account → Database backup & restore**. A server-side copy is kept in the project's `local-backups` folder; also copy downloads to a USB drive.
