# PageMint cliffdemo3 NMS server change

Date: 2026-09-12
Server: Hostinger VPS `root@89.116.33.19`
Project: `/srv/news-management-system`
Current release at change time: `/srv/news-management-system/current -> /srv/news-management-system/releases/2e5da0f`

## Goal

Assign the PageMint/API external ID `cliffdemo3` to the NMS newspaper generator payload while keeping every existing NMS ID and callback behavior unchanged.

This is intentionally a small live-server change. It does not change the database schema, does not rename any NMS user, and does not change PDF callback ownership.

## Files changed on server

Changed:

- `/srv/news-management-system/current/server/services/newspaperGenerator.js`

Backup created before editing:

- `/srv/news-management-system/backups/pagemint-cliffdemo3-20260912112643/newspaperGenerator.js.before`

No database rows were changed.
No secrets were changed.
No `backend.env` value was changed.

## Behavior added

`buildNewspaperPayload()` now adds a PageMint-specific target ID with value `cliffdemo3`.

New outgoing payload fields:

```js
pagemint_user_id: 'cliffdemo3'
pagemint_target_id: 'cliffdemo3'
targetUser.pagemintId: 'cliffdemo3'
targetUser.externalId: 'cliffdemo3'
callback.pagemintTargetId: 'cliffdemo3'
pdfCallback.pagemintTargetId: 'cliffdemo3'
```

The existing fields still use the original numeric NMS user ID:

```js
target_user_id: targetUser.id
targetUser.id: targetUser.id
callback.targetUserId: targetUser.id
pdfCallback.targetUserId: targetUser.id
```

This is important because `/api/webhook/newspaper-pdf` stores returned PDFs against the NMS `users.id` numeric value. Changing that numeric callback ID to `cliffdemo3` would break PDF storage.

## Exact code pattern to port into Git/Vercel source

In `server/services/newspaperGenerator.js`, add this helper after `generateEditionId()`:

```js
function getPageMintTargetId() {
    return process.env.NEWSPAPER_GENERATOR_PAGEMINT_USER_ID || 'cliffdemo3';
}
```

Inside `buildNewspaperPayload()`, after `editionId` is created, add:

```js
const pageMintTargetId = getPageMintTargetId();
```

In the returned payload, keep the original `target_user_id`, then add:

```js
target_user_id: targetUser.id,
pagemint_user_id: pageMintTargetId,
pagemint_target_id: pageMintTargetId,
```

Inside `targetUser`, keep `id: targetUser.id`, then add:

```js
id: targetUser.id,
pagemintId: pageMintTargetId,
externalId: pageMintTargetId,
```

Inside both `callback` and `pdfCallback`, keep `targetUserId: targetUser.id`, then add:

```js
targetUserId: targetUser.id,
pagemintTargetId: pageMintTargetId,
```

## Optional environment variable

The code defaults to `cliffdemo3`. If later you want to change it without code, set this env var in the NMS backend environment:

```bash
NEWSPAPER_GENERATOR_PAGEMINT_USER_ID=cliffdemo3
```

For the current live server change, this env var was not required because the code fallback already assigns `cliffdemo3`.

## Verification notes

After porting, run a syntax check on the changed file. On the server this was validated with Node syntax check before backend restart.

A payload preview or API send from NMS should show the new `pagemint_*` fields, while `target_user_id` remains the numeric NMS user ID.

## Important rule for future Codex session

When updating Git/Vercel from this server change, do not replace numeric `target_user_id` or callback target IDs with `cliffdemo3`. Add `cliffdemo3` only as the PageMint/external ID fields listed above.
