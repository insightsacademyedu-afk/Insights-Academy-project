# Academy Management

This project supports both a local Windows installation and a hosted production deployment. The local setup keeps the React interface, Express API and MongoDB database on the same computer.

## Requirements

- Node.js 22.12 or newer
- MongoDB running locally
- The already-installed `client` and `server` dependencies

Keep `server/.env` private. Its database setting must point to the local machine, for example:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/academy_management?replicaSet=academy-rs
```

Double-click `start-local.cmd` to build and launch the app. It opens at `http://127.0.0.1:5000`. The optimized build uses one server instead of keeping separate development servers running.

The database uses a one-machine replica set so student enrollment, payments and other multi-record operations remain transaction-safe. On a new administrator laptop, run `configure-local-mongodb.ps1` once as Administrator before starting the app.

## Hosted deployment

For a live deployment, use a Node.js host that supports Node.js 22.12 or newer and a hosted MongoDB provider. Build the client with `npm.cmd --prefix client run build`, then start the server with `npm.cmd --prefix server start`. Production reads the hosting platform's `PORT` and listens on `0.0.0.0` by default.

Set these private production environment variables on the host:

```dotenv
NODE_ENV=production
MONGO_URI=<hosted MongoDB connection string>
JWT_SECRET=<long random secret of at least 32 characters>
CLIENT_URL=https://<your-live-domain>
SEED_ADMIN_USERNAME=<initial admin username>
SEED_ADMIN_EMAIL=<initial admin email>
SEED_ADMIN_PASSWORD=<initial admin password>
```

The administrator's **Create & download backup** action downloads the complete `.academy-backup` file to the administrator's computer. Keep that downloaded file on a separate device or cloud drive. The server-side `local-backups` copy is only an extra convenience and must not be treated as durable storage on free or ephemeral hosting.

## Academy details, receipts and backups

Sign in as an administrator and open **My account**. There you can:

- edit the academy name and phone number;
- edit the name, phone and footer printed on payment receipts;
- create and download a complete `.academy-backup` database backup;
- inspect and restore a selected backup file.

Every created backup is also saved in `local-backups` beside this README. Copy downloaded backups to a USB drive or another physical device; a backup left only on the laptop will be lost if the drive fails.

Restore replaces the current database. The app validates the file, requires the word `RESTORE`, and creates an automatic pre-restore safety backup in `local-backups` first.

## Development and checks

```powershell
npm.cmd --prefix server test
npm.cmd --prefix client test
npm.cmd --prefix client run lint
npm.cmd --prefix client run build
```

Automated server tests use an isolated temporary MongoDB and never target the academy database.
