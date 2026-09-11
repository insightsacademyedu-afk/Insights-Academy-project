# Academy Management client

React/Vite client. Follow the root README for database, API and deployment setup.

From this directory:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The default `VITE_API_URL=/api` uses Vite's development proxy to port 5000. Start the server separately, then open http://localhost:5173. Production uses one HTTPS origin: build with `npm run build` and keep `client/dist` beside `server`. Express serves it when NODE_ENV=production. Never put private values in VITE_* settings.

```powershell
npm test
npm run lint
npm run build
```

Tests cover shared API/auth components, pagination, stale-request handling and page flows including setup, students, fees, tests, salaries, notifications and reports. See the root PROGRESS.md for exact measured results, lint warnings and external checks. Tests mock network responses; the separate server runtime smoke exercises real HTTP and a local MongoDB replica set.
