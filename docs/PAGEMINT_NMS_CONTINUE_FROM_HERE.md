# PageMint NMS continue-from-here note

Date: 2026-09-12

Use this note when returning to NMS after the PageMint laptop/source changes are done.

## Current NMS status

NMS is already updated, pushed, and deployed for the current integration contract.

Latest pushed NMS commits:

```txt
ebe6ce5 Port PageMint newspaper generator server changes
59b0f56 Document PageMint PDF callback plan and shorten API PDF retention
8299349 Expand PageMint NMS PDF handoff plan
971f37a Clarify PageMint used bundle cleanup timing
```

Current local branch should be:

```txt
main...origin/main
```

with no local changes.

Current deployed NMS backend release:

```txt
/srv/news-management-system/releases/59b0f56
```

The later commits `8299349` and `971f37a` were documentation-only, so no backend redeploy was needed for them.

## NMS behavior already working

NMS sends bundles to PageMint:

```env
NEWSPAPER_GENERATOR_URL=https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
NEWSPAPER_GENERATOR_PAGEMINT_USER_ID=cliffdemo3
```

NMS outgoing payload includes PageMint external fields:

```js
pagemint_user_id: "cliffdemo3"
pagemint_target_id: "cliffdemo3"
targetUser.pagemintId: "cliffdemo3"
targetUser.externalId: "cliffdemo3"
callback.pagemintTargetId: "cliffdemo3"
pdfCallback.pagemintTargetId: "cliffdemo3"
```

NMS numeric fields are preserved for PDF ownership:

```js
target_user_id: <numeric NMS user id>
targetUser.id: <numeric NMS user id>
callback.targetUserId: <numeric NMS user id>
pdfCallback.targetUserId: <numeric NMS user id>
```

Do not replace numeric callback IDs with `cliffdemo3`.

NMS receives PDFs at:

```txt
POST https://nms-api.thecliffnews.in/api/webhook/newspaper-pdf
```

Expected multipart fields from PageMint:

```txt
target_user_id=<numeric NMS user id>
job_id=<payload.job_id>
bundle_id=<payload.bundle_id>
edition_id=<payload.edition_id>
status=generated
pdf=<real PageMint PDF>
```

NMS stores returned PDFs in `api_pdfs`, and the Editor PDF section reads:

```txt
GET /api/editor/api-targets/<numeric-user-id>/pdfs
```

## NMS retention already changed

When `ENABLE_NEWS_CLEANUP=true`:

- Generated API PDFs in NMS are removed after about `30-31 hours`.
- NMS news/images/ads remain on the existing `48-49 hour` retention.

This is implemented in:

```txt
server/index.js
```

## PageMint server docs created

The main handoff doc is on the PageMint VPS at:

```txt
/opt/newspaper-generator/docs/PAGEMINT_NMS_REAL_PDF_COMPATIBILITY_PLAN.md
```

It is also copied into this NMS repo at:

```txt
docs/PAGEMINT_NMS_REAL_PDF_COMPATIBILITY_PLAN.md
```

Related PageMint/NMS server notes:

```txt
/opt/newspaper-generator/docs/NMS_BUNDLE_RECEIVER_SERVER_CHANGE.md
/srv/news-management-system/current/docs/PAGEMINT_CLIFFDEMO3_SERVER_CHANGE.md
/srv/news-management-system/current/docs/NMS_BUNDLE_RECEIVER_SERVER_CHANGE.md
```

## PageMint work still needed on laptop/source

PageMint currently receives and stores NMS bundles, but it does not yet create a real PageMint PDF automatically.

Needed PageMint change:

```txt
NMS sends bundle
PageMint receives bundle
PageMint generates real newspaper PDF automatically
PageMint posts that PDF back to NMS webhook
NMS shows PDF under the assigned numeric target user
```

Scope must stay narrow:

- Enable only for `cliffdemo3` and future deliberately mapped NMS API-enabled IDs.
- Do not change unrelated PageMint publishers.
- Do not change normal PageMint editor UI.
- Do not change wallet flow, portal login, domains, or other production behavior.

PageMint retention requirement:

- Used NMS bundle JSON files: clear after about `1 hour` once PDF generation/callback has used them.
- Generated PageMint PDF artifacts: clear after about `30 hours`.
- Cleanup only NMS integration folders.

## Prompt to use in PageMint Codex

```txt
I made live-server NMS compatibility notes on the Hostinger VPS.

Please SSH/read this file first:

/opt/newspaper-generator/docs/PAGEMINT_NMS_REAL_PDF_COMPATIBILITY_PLAN.md

Also read:

/opt/newspaper-generator/docs/NMS_BUNDLE_RECEIVER_SERVER_CHANGE.md

Then update my local PageMint source to make it compatible with NMS.

Goal:
- PageMint already receives NMS bundles at POST /api/nms-bundle.
- Add automatic real PDF generation from the NMS bundle, without manual editor click/download.
- Use pagemint_user_id / pagemint_target_id = cliffdemo3 only for PageMint settings, layouts, and categories.
- Keep numeric target_user_id for the NMS callback.
- Send the generated PDF back to NMS using payload.callback.url or payload.pdfCallback.url as multipart/form-data.
- Include target_user_id, job_id, bundle_id, edition_id, status, and pdf.
- If NMS sends too few news items, fill shortage from PageMint category/newswire content for that id.
- Used NMS bundle JSON should be cleared after about 1 hour once PDF generation/callback has used it.
- Generated NMS PDFs in PageMint should be kept about 30 hours.
- Do not change unrelated PageMint publishers, normal editor UI, wallet flow, portal login, domains, or other production behavior.

After changes:
- Run tests/build checks.
- Tell me exactly what files changed.
```

## When PageMint laptop changes are done

Come back to this NMS repo and ask:

```txt
Continue from docs/PAGEMINT_NMS_CONTINUE_FROM_HERE.md. PageMint source changes are done. Verify NMS/PageMint integration and send a real PDF callback test.
```

Then verify:

1. `git status --short --branch`
2. NMS health:

```powershell
Invoke-WebRequest https://nms.thecliffnews.in/api/health -UseBasicParsing
Invoke-WebRequest https://nms-api.thecliffnews.in/api/health -UseBasicParsing
```

3. PageMint receiver:

```powershell
Invoke-WebRequest https://generator.pagemint1.gautamenterprises.org/api/nms-bundle -UseBasicParsing
```

4. Send a test NMS bundle for an API-enabled user.
5. Confirm PageMint generates the real PDF.
6. Confirm PageMint posts the PDF back to NMS.
7. Confirm NMS PDF section shows the latest real PageMint PDF under the numeric target user.
8. Confirm used PageMint bundle JSON is cleared after about 1 hour.
9. Confirm generated PDFs are cleared after about 30 hours.
