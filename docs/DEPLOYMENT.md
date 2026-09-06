# Deployment

## Stage 1: GitHub and Vercel frontend

The GitHub repository contains the application source. Local environment secrets,
SQLite databases, uploaded photos, dependencies, and scratch scripts are excluded.
Existing local data must be migrated separately when the backend is deployed.

Import `gautamenterprisesprojects-eng/news_management_system` into Vercel as a new
project. Use the repository root (`.`) and the Other framework preset. The root
`vercel.json` skips dependency installation and the build, and serves `public`.
No frontend environment variables are required at this stage.

This deploys the interface only. Login, profiles, news, AI rewriting, and uploaded
images require the Express backend and will not work on this frontend deployment
until stage 2 is complete. Never put AI keys or JWT secrets in the frontend.

## Stage 2: Backend on Hostinger (pending)

### Safe deployment sequence for the shared VPS

1. **Inspect without changes.** Identify both existing projects, their health URLs,
   service managers, runtime versions, ports, reverse proxy, firewall rules, and
   available CPU, RAM, and disk. Record their current health as a baseline.
2. **Prepare recovery.** Verify current backups and how to restore them. Save the
   relevant proxy and service configuration before editing it. Prepare a rollback
   that removes only the new app's service and proxy entry; a whole-server restore
   is not the routine rollback because it could overwrite other projects' data.
3. **Resolve local startup blockers.** Correct the remaining `db.run` calls left
   from the database-driver migration, test fresh database initialization in an
   isolated test directory, review schema compatibility, and make the hourly
   48-hour deletion job explicitly controllable before importing existing news.
   Use a strong JWT secret and replace the default admin password before exposure.
4. **Create isolated application storage and execution.** Proposed directory:
   `/srv/news-management-system`, subject to checking that it does not already
   exist. Use a dedicated unprivileged account, private environment file, separate
   database/uploads, an unused loopback port, and a uniquely named service with
   resource limits. Choose the runtime based on the inspection; do not replace
   a shared Node.js version or introduce a new server-wide runtime unnecessarily.
5. **Start privately.** Install and start only this application's dependencies and
   service. Test health, authentication, database writes, and uploads through
   loopback or an SSH tunnel. Recheck both existing projects and server capacity.
6. **Expose a dedicated HTTPS hostname.** Add only the new site's reverse-proxy
   configuration using the existing proxy's supported layout. Validate the complete
   configuration before a graceful reload. Do not restart all application services,
   replace global proxy configuration, or change existing sites' DNS. Check all
   three applications immediately afterward.
7. **Connect Vercel.** Add backend rewrites for API and upload paths only after
   the backend HTTPS endpoint passes checks. Verify the full browser workflow.
8. **Observe and keep rollback ready.** Monitor resource use and errors, configure
   this application's backups and log rotation, and verify its restart policy
   without rebooting the shared server. If existing sites regress, stop the new
   app and revert only its configuration changes.

A separate folder does not isolate CPU, RAM, disk, or shared proxy failures. If
the inspection shows insufficient capacity or a required disruptive shared change,
pause this deployment and use a separate VPS instead.

Before changing the VPS, inspect the existing services, reverse proxy, ports,
resource usage, and backups. Deploy this application in its own directory and
process, on an unused local port, with a dedicated backend hostname and HTTPS.
Review the database migration and cleanup code before starting the backend.

Configure backend secrets from `.env.example`, and migrate the existing database
and uploads separately if existing accounts and articles must be retained.

The frontend currently uses same-origin `/api/*` and `/uploads/*` URLs. Once the
backend HTTPS hostname is known, add Vercel external rewrites for these paths to
that backend. Avatar URLs under `/uploads/avatars/*` also need to reach it.
Then verify login, article submission, rewriting, image downloads, and profiles.

Marking news as published is an internal database state; it does not automatically
publish articles to an external news website or social media account.
