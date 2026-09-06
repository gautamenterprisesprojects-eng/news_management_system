# Isolated Hostinger backend

Deployment root: `/srv/news-management-system`. Copy `compose.yaml` to that root.
Keep immutable source releases under `releases/`, with `current` pointing at the
selected release. Each release includes production dependencies installed using
the same Node image as the service. Keep writable SQLite and uploads under `data/`.

Create a root-only `.env` containing `NMS_NODE_IMAGE=node@sha256:...` and a
root-only `backend.env` containing a strong `JWT_SECRET` and a unique
`ADMIN_INITIAL_PASSWORD` (minimum 16 characters), plus backend AI settings.
Do not commit either file. The data directory must be writable by container UID
1000. The deployment root should be accessible only to administrators.

Always use `docker compose -p news-management-system` from this deployment root.
Never run Compose commands from either existing project's directory.

The app binds only to host loopback port 3010. It needs a separate Nginx HTTPS
virtual host before Vercel can connect. CPU/memory/process limits and rotating logs
are configured in Compose. Automatic 48-hour deletion is enabled.

## Validation

Run `node tests/deployment-smoke.cjs` before release. It uses temporary data and
does not call external AI providers. Run it in the deployment image too.

## Rollback

Before any proxy edits, save existing configuration and record existing sites'
HTTP statuses and service/container IDs. To withdraw this app, run
`docker compose -p news-management-system stop backend` from its own root. If a
new Nginx site has been enabled, remove only that site's enabled link, validate
with `nginx -t`, and gracefully reload. Restore the previous Vercel rewrites.
Keep data and releases for recovery. Do not restore the entire VPS for an ordinary
application rollback or remove volumes with `down -v`.

Back up SQLite with its online backup API (not a raw copy of a live WAL database),
and back up uploads separately. A coordinated maintenance window for this app can
be used when a database-and-images snapshot must be consistent. Test recovery
into an isolated directory before relying on the backup.
