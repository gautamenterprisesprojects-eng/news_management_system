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
