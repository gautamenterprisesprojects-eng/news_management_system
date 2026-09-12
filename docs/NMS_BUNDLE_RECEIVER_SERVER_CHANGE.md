# NMS bundle receiver live-server change

Date: 2026-09-12
Server: Hostinger VPS `root@89.116.33.19`
Generator project: `/opt/newspaper-generator`
NMS project: `/srv/news-management-system`

## Goal

Make NMS able to send newspaper bundles to the live PageMint/Newspaper Generator app and make the generator store what it receives for verification.

This change keeps the existing NMS PDF callback flow unchanged. NMS still expects generated PDFs back at `/api/webhook/newspaper-pdf` using numeric `target_user_id`.

## Files changed

Generator changed:

- `/opt/newspaper-generator/src/app/api/nms-bundle/route.ts`
- `/opt/newspaper-generator/docker-compose.yml`

NMS changed:

- `/srv/news-management-system/backend.env`

Docs added:

- `/opt/newspaper-generator/docs/NMS_BUNDLE_RECEIVER_SERVER_CHANGE.md`

Backups created before editing:

- `/opt/newspaper-generator/backups/nms-bundle-receiver-20260912130624/docker-compose.yml.before`
- `/srv/news-management-system/backups/nms-bundle-receiver-20260912130624/backend.env.before`

## Behavior added

The generator now has this receiver route:

```txt
POST /api/nms-bundle
GET  /api/nms-bundle
```

`POST /api/nms-bundle` accepts the NMS JSON bundle, validates that it contains an `articles` array, stores the full payload and a summary, and returns a success JSON response.

Stored files are written inside the generator container path:

```txt
/app/data/nms-bundles
```

This is bind-mounted to the host path:

```txt
/opt/newspaper-generator/data/nms-bundles
```

The latest received files are:

```txt
/opt/newspaper-generator/data/nms-bundles/latest.json
/opt/newspaper-generator/data/nms-bundles/latest.summary.json
```

`GET /api/nms-bundle` returns the latest summary and recent stored JSON filenames.

## NMS configuration added

NMS backend env now includes:

```bash
NEWSPAPER_GENERATOR_URL=https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
```

No generator API key was added. The receiver route supports optional auth via `NMS_BUNDLE_API_KEY` or `NEWSPAPER_GENERATOR_API_KEY`, but auth is not required unless one of those env vars is configured in the generator container.

## Important ID behavior

The previous `cliffdemo3` PageMint ID change remains intact. NMS sends both:

```js
target_user_id: <numeric NMS user id>
pagemint_user_id: "cliffdemo3"
pagemint_target_id: "cliffdemo3"
```

Do not replace the numeric callback IDs with `cliffdemo3`; generated PDFs must still be posted back to NMS with numeric `target_user_id`.

## How to verify

Check receiver status:

```bash
curl -sS https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
```

Check latest stored summary from the server:

```bash
cat /opt/newspaper-generator/data/nms-bundles/latest.summary.json
```

When NMS sends a bundle, the response should include:

```json
{ "success": true, "received": true }
```

## How to port to Git/Vercel/source on another laptop

1. Copy `/opt/newspaper-generator/src/app/api/nms-bundle/route.ts` into the generator repo at the same path.
2. If running in Docker, add this to the generator service:

```yaml
environment:
  NMS_BUNDLE_DIR: /app/data/nms-bundles
volumes:
  - ./data/nms-bundles:/app/data/nms-bundles
```

3. Configure NMS backend env with:

```bash
NEWSPAPER_GENERATOR_URL=https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
```

4. Keep the earlier `cliffdemo3` external ID fields exactly as documented in `/srv/news-management-system/current/docs/PAGEMINT_CLIFFDEMO3_SERVER_CHANGE.md`.
