# Running this local copy

The updated working project is D:\projects NEW\academy-management-updated.

Start two PowerShell terminals from this folder:

1. npm --prefix server run dev
2. npm --prefix client run dev

Open http://localhost:5173/ and refresh with Ctrl+F5. My account is available to admin and staff. Currency is PKR.

## One-click startup on Windows

After Node.js 22.12 or newer is installed and the dependencies and private `.env` files are configured, double-click `start-local.ps1`. It opens separate backend and frontend windows, waits for both services, and opens the application at `http://localhost:5173/`. VS Code is not required.

If Windows blocks the script, right-click it, choose **Properties**, select **Unblock**, and click **Apply**. The script uses PowerShell's temporary execution-policy bypass and does not change the machine policy.

The backend still needs a working MongoDB Atlas connection. Add the computer's current public IP to Atlas **Network Access**, or use a local MongoDB replica set. The computer must remain connected to the network while the app is running.

This machine requires DNS_SERVERS in the private server/.env for Atlas SRV lookup; the previous project's resolver settings were restored there. Database credentials were preserved. client/.env uses VITE_API_URL=/api and Vite proxies to port 5000.

The older workspace ZIP predates the follow-up changes. Use this directory as your working copy.

The academy operating target is an HTTPS deployment accessible from anywhere, with MongoDB Atlas and an automatic verified backup every day at 8:00 PM Pakistan time. The Windows task installer now defaults to 20:00 and checks for Pakistan Standard Time. A cloud schedule must use `20:00 Asia/Karachi` or `15:00 UTC`; provider-specific setup still depends on the hosting service selected.

Checks: actual localhost frontend serves the new account page and PKR formatter; /api/health responds through the frontend proxy; the authenticated password-change route now exists (unauthenticated request returns 401, previously 404). No user password was changed and no live financial transaction was submitted for these checks.
