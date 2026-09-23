# Neon development database

Use a dedicated development project for this checkout, not a production database.

1. Sign in at https://console.neon.tech/ and select the Free plan. Check the displayed limits; do not enable a paid plan for this setup.
2. Create `lingua-studio-dev`, PostgreSQL 17, preferably AWS Frankfurt for this Romanian development environment. Keep the default database and role names.
3. Open **Connect**, select the development branch/database and disable **Connection pooling** for the initial migration connection.
4. Copy only the `postgresql://...` URL, not the `psql` command. Keep its security query parameters.
5. Create or edit `.env.local` in the project root, next to `package.json`:

   ```dotenv
   DATABASE_URL="paste-the-Neon-connection-URL-here"
   ```

Replace the placeholder. Never paste the real URL into chat, screenshots, logs or Git. `.env.local` is ignored by Git. Restart the development server after changing environment variables.

## Validate and initialize

In PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`; no policy change is necessary.

```powershell
npm.cmd run db:check
npm.cmd run db:inspect
```

Inspection is read-only. It reports the database name, PostgreSQL version, client TLS policy and table names, without credentials or row contents. Verify that the selected Neon project is the intended development project and review any existing tables before proceeding. A fresh database should have no application tables.

Then apply the reviewed migration and repeatable reference seed:

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:inspect
```

Expected application tables: `courses`, `languages`, `learner_profiles`, `users`, plus Drizzle's migration ledger. The seed contains five languages and no user accounts. Repeat migrate/seed to verify idempotence; do not reset the database.

The current `DATABASE_URL` is used by both application and CLI scripts. A direct Neon connection is sufficient for this local setup. Revisit separate pooled runtime/direct migration URLs when deploying serverless authentication. External hosts require certificate and hostname verification (`verify-full`). The PostgreSQL `pg_stat_ssl` view on Neon can report the proxy-to-backend connection rather than the application's client-to-proxy TLS state.

## If a connection fails

- Confirm `.env.local` is in the project root and contains the complete URL, not an example or a `psql` wrapper.
- Confirm the selected Neon branch/compute is available and the password has not been reset.
- Check whether the network permits PostgreSQL connections to port 5432.
- Do not disable certificate verification or share credentials to troubleshoot.

References: [Neon project creation](https://api-docs.neon.tech/reference/createproject), [connection URI](https://api-docs.neon.tech/reference/getconnectionuri), [Neon branching workflow](https://neon.com/docs/get-started-with-neon/workflow-primer).
