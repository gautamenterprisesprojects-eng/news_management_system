# NMS Deployment Runbook

This document is the safe repeatable process for deploying the News Management System without disturbing the other two projects on the Hostinger KVM server.

Do not put passwords, private SSH keys, `.env` files, databases, or uploads in git. Sensitive access details are kept in `scratch/NMS_PRIVATE_ACCESS_RUNBOOK.md`, which is ignored by git.

## Live services

| Service | URL / location | Notes |
| --- | --- | --- |
| Frontend | https://nms.thecliffnews.in | Vercel project `gautam-tech-studio/news-management-system` |
| Backend API | https://nms-api.thecliffnews.in | Hostinger VPS, Nginx proxy, Docker container |
| GitHub repo | https://github.com/gautamenterprisesprojects-eng/news_management_system.git | Push to `main` only after local testing and approval |
| VPS | `89.116.33.19` | Hostinger KVM 2, Ubuntu 24.04 LTS |

## Current backend layout

The backend is isolated from the existing projects as much as possible on the shared VPS:

- App root: `/srv/news-management-system`
- Release folders: `/srv/news-management-system/releases/<commit-sha>`
- Active release symlink: `/srv/news-management-system/current`
- Persistent data: `/srv/news-management-system/data`
- Persistent uploads: inside the NMS data/uploads path, separate from other projects
- Docker Compose project name: `news-management-system`
- Backend container: `news-management-system-backend-1`
- Backend internal port: container `3000`
- Host binding: `127.0.0.1:3010`
- Public API hostname: `nms-api.thecliffnews.in`
- Nginx config: `/etc/nginx/sites-available/nms-api.thecliffnews.in`
- Auto cleanup: enabled only for NMS, deletes NMS news/images older than 48 hours

The other projects must not be stopped, recreated, renamed, or edited during NMS deployment.

## Safe deployment rule

For every change batch:

1. Make code changes locally.
2. Run local syntax/API/browser checks that match the changed area.
3. Ask the project owner before pushing.
4. Push to GitHub only after approval.
5. Wait for/check Vercel frontend deployment.
6. Deploy the backend release to Hostinger only if backend files changed.
7. Verify NMS health.
8. Verify existing project baselines.

## Existing project safety baselines

Before and after every backend deployment, check these existing sites. The expected statuses are intentionally recorded so a change in behavior is visible immediately.

| Existing service | Expected status |
| --- | --- |
| `https://api.thecliffnews.in/` | `404` |
| `https://cms.thecliffnews.in/` | `200` |
| `https://pagemint1.gautamenterprises.org/` | `403` |
| `https://generator.pagemint1.gautamenterprises.org/` | `403` |

Use this command from the VPS:

```bash
for url in \
  https://api.thecliffnews.in/ \
  https://cms.thecliffnews.in/ \
  https://pagemint1.gautamenterprises.org/ \
  https://generator.pagemint1.gautamenterprises.org/; do
  printf '%s -> ' "$url"
  curl -k -s -o /dev/null -w '%{http_code}\n' "$url"
done
```

## Local checks before push

Run at least the syntax check for edited JavaScript files:

```powershell
node --check public/js/pages/editor.js
node --check public/js/pages/reporter.js
node --check public/js/pages/login.js
node --check public/js/i18n.js
node --check server/routes/editor.js
node --check server/routes/reporter.js
node --check server/index.js
```

For backend/API changes, start a local server with an isolated scratch database:

```powershell
$testDir = "scratch/local-ui-test-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force $testDir | Out-Null
$env:DATA_DIR = (Resolve-Path $testDir).Path
$env:NODE_ENV = 'development'
$env:PORT = '3105'
$env:HOST = '127.0.0.1'
$env:ENABLE_NEWS_CLEANUP = 'false'
$env:JWT_SECRET = 'local-test-secret-local-test-secret-123456'
node server/index.js
```

Then test login, article submission, image upload, rewrite/edit/forward/publish flows, and browser console errors.

## GitHub and Vercel deployment

After local testing and owner approval:

```powershell
git status --short
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Vercel deploys the frontend from GitHub. After the deployment finishes, verify:

```powershell
Invoke-WebRequest https://nms.thecliffnews.in/api/health -UseBasicParsing
Invoke-WebRequest https://nms.thecliffnews.in/images/logo-wide.png -UseBasicParsing
```

The Vercel project must keep rewrites for backend API/upload traffic to `https://nms-api.thecliffnews.in`.

## Backend deployment from Windows

Use SSH key access. Do not use root password login for routine deployment.

Create a release archive from the exact commit that was pushed:

```powershell
$commit = git rev-parse --short HEAD
$archive = "scratch/release-$commit.tar"
git archive --format=tar --output=$archive HEAD
scp -i C:\Users\hp\.ssh\nms_hostinger_ed25519 $archive root@89.116.33.19:/srv/news-management-system/release-$commit.tar
```

Deploy it on the server. The build image is used only to install native dependencies safely; the runtime container remains small.

```powershell
$commit = git rev-parse --short HEAD
$node = @"
const { spawnSync } = require('child_process');
const key = 'C:\\\\Users\\\\hp\\\\.ssh\\\\nms_hostinger_ed25519';
const commit = '$commit';
const script = `set -euo pipefail
cd /srv/news-management-system
mkdir -p releases/$commit
tar -xf release-$commit.tar -C releases/$commit
chown -R 1000:1000 releases/$commit
build_image="node@sha256:be23f54a88d34e8824c741b19b91064094f92c1c97b194144bfc8b50d67258e2"
docker run --rm --name nms-dependency-install-$commit --user 1000:1000 --cpus=0.5 --memory=1024m --memory-swap=1024m --pids-limit=150 --cap-drop=ALL --security-opt=no-new-privileges -e npm_config_nodedir=/usr/local --mount type=bind,src=/srv/news-management-system/releases/$commit,dst=/app -w /app "$build_image" npm ci --omit=dev --no-audit --no-fund
chmod -R go-w releases/$commit
ln -sfn "releases/$commit" current.next
mv -Tf current.next current
docker compose -p news-management-system up -d --force-recreate backend
docker compose -p news-management-system ps
curl -fsS http://127.0.0.1:3010/api/health
`;
const res = spawnSync('ssh', ['-i', key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', 'root@89.116.33.19', 'bash', '-s'], { input: script, encoding: 'utf8', timeout: 120000 });
process.stdout.write(res.stdout);
process.stderr.write(res.stderr);
process.exit(res.status ?? 1);
"@
$node | node
```

Why `--force-recreate` matters: the container bind mount points to the previous release directory until the container is recreated. Changing the `current` symlink alone is not enough.

## Post-deploy verification

Run these checks after backend deployment:

```powershell
Invoke-WebRequest https://nms.thecliffnews.in/api/health -UseBasicParsing
Invoke-WebRequest https://nms-api.thecliffnews.in/api/health -UseBasicParsing
```

On the VPS:

```bash
docker compose -p news-management-system ps
docker stats --no-stream news-management-system-backend-1
journalctl -u ssh --since '20 minutes ago' --no-pager | tail -80
```

Also verify the existing project baselines listed above.

## Rollback

Rollback is release-based and should affect only NMS.

1. SSH into the VPS.
2. List releases:

```bash
ls -lt /srv/news-management-system/releases
```

3. Point `current` back to the previous known-good release and recreate only the NMS backend container:

```bash
cd /srv/news-management-system
ln -sfn releases/<previous-commit-sha> current.next
mv -Tf current.next current
docker compose -p news-management-system up -d --force-recreate backend
curl -fsS http://127.0.0.1:3010/api/health
```

4. Check NMS and existing project baselines.

Do not restore the whole VPS unless the Hostinger backup restore is the only remaining option, because that could roll back data for the other important projects too.

## DNS records

Cloudflare manages DNS for `thecliffnews.in`.

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `nms` | CNAME | Vercel target shown in Vercel Domains page | DNS only |
| `_vercel` | TXT | Vercel domain verification value | DNS only |
| `nms-api` | A | `89.116.33.19` | DNS only |

Keep `nms-api` DNS-only unless the backend and Cloudflare SSL/proxy settings have been deliberately tested.

## Nginx and SSL

The backend API is exposed through Nginx and Let’s Encrypt.

Common checks:

```bash
nginx -t
systemctl reload nginx
certbot certificates | grep -A20 nms-api.thecliffnews.in
```

Nginx currently has an unrelated duplicate MIME warning in another site config. Syntax still succeeds. Do not edit unrelated site configs during NMS deployment.

## Disk cleanup

NMS cleanup is enabled with:

```env
ENABLE_NEWS_CLEANUP=true
```

The cleanup job runs hourly and removes NMS news/images older than 48 hours. It does not clean files from the other projects.

Check the setting:

```bash
cd /srv/news-management-system/current
docker compose -p news-management-system exec backend printenv ENABLE_NEWS_CLEANUP
```

## What must never be committed

- `.env` or `.env.*`
- SQLite databases and WAL/SHM files
- Upload folders
- Private SSH keys
- Password documents
- `scratch/` files
- Release archives and deployment zips
