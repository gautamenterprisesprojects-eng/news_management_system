# PageMint NMS real PDF compatibility plan

Date: 2026-09-12
Scope: Cliff News demo / NMS API-enabled users only

## Goal

Make PageMint receive NMS newspaper bundles, generate the real PageMint newspaper PDF using the assigned PageMint/NMS identity, and send that PDF back to NMS so it appears under the assigned user's PDF section.

This must be a narrow production change. Do not change unrelated PageMint publishers, layouts, wallet behavior, portal login, or existing browser editor behavior.

## Current state

NMS already sends bundles to:

```txt
https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
```

PageMint currently stores the bundle JSON at:

```txt
/opt/newspaper-generator/data/nms-bundles/latest.json
/opt/newspaper-generator/data/nms-bundles/latest.summary.json
```

The current PageMint route returns `{ "success": true, "received": true }`, but it does not yet generate a real PDF and does not call back to NMS.

## NMS fields PageMint must preserve

Use PageMint identity fields for PageMint routing/settings:

```js
pagemint_user_id: "cliffdemo3"
pagemint_target_id: "cliffdemo3"
targetUser.pagemintId: "cliffdemo3"
targetUser.externalId: "cliffdemo3"
```

Use numeric NMS IDs only for the callback:

```js
target_user_id: 37
callback.targetUserId: 37
pdfCallback.targetUserId: 37
```

Never post `cliffdemo3` as `target_user_id` to NMS. NMS stores PDFs against numeric `users.id`.

## PageMint implementation needed

Add a server-side/headless generation bridge in the PageMint source. The safest shape is:

```txt
POST /api/nms-bundle
  1. Validate and store bundle.
  2. If pagemint_user_id/pagemint_target_id is allowed, enqueue/generate the PDF.
  3. Use the PageMint settings/layout/categories for that PageMint id.
  4. Fill missing article slots from PageMint category/newswire sources.
  5. Upload the real generated PDF to NMS callback.
```

Only enable this for:

```txt
cliffdemo3
```

and future NMS API-enabled ids that are deliberately mapped. Keep all other PageMint behavior unchanged.

## Suggested PageMint files

Current live server paths to inspect before coding:

```txt
/opt/newspaper-generator/src/app/api/nms-bundle/route.ts
/opt/newspaper-generator/src/components/editor/PortalLaunchBootstrap.tsx
/opt/newspaper-generator/src/components/editor/EditorCanvas.tsx
/opt/newspaper-generator/src/engines/PrintPDFEngine/PrintPDFEngine.ts
/opt/newspaper-generator/src/engines/EditionComposer/EditionComposer.ts
/opt/newspaper-generator/src/engines/TemplateLayout/TemplateRegistry.ts
/opt/newspaper-generator/src/app/api/newswire/route.ts
```

The current PDF export path is browser-driven in `EditorCanvas.tsx`. For NMS automation, PageMint needs a server/headless equivalent that can build the document and produce PDF bytes without a person clicking the editor download button.

## Article and page behavior

When NMS sends 10-20 articles:

- Use the first/front-page capacity from PageMint's selected front-page template.
- Put remaining articles onto page 2 and later inside pages.
- Keep NMS article images attached to their own `newsId`.
- If an NMS article has no image, render it as text-only and do not reserve blank image space.
- If NMS sends too few articles for the selected PageMint page settings, fill the shortage from PageMint category/newswire content for that id.
- Use the category/page settings defined by PageMint for the assigned id.

## Callback back to NMS

After generating the real PDF, PageMint must call:

```txt
POST https://nms-api.thecliffnews.in/api/webhook/newspaper-pdf
Content-Type: multipart/form-data
```

Required fields:

```txt
target_user_id=<numeric NMS user id>
pdf=<real generated PDF file>
```

Recommended tracking fields:

```txt
job_id=<payload.job_id>
bundle_id=<payload.bundle_id>
edition_id=<payload.edition_id>
status=generated
```

Use `payload.callback` first. Fall back to `payload.pdfCallback` for backward compatibility.

## Retention requirement

For the Cliff News/NMS integration only:

- Keep generated PageMint PDFs for about 30 hours.
- Clean PageMint NMS bundle JSON and generated PDF artifacts after 30 hours.
- Do not clean unrelated PageMint user data.

Suggested env/config:

```env
NMS_BUNDLE_DIR=/app/data/nms-bundles
NMS_GENERATED_PDF_DIR=/app/data/nms-generated-pdfs
NMS_GENERATED_PDF_RETENTION_HOURS=30
```

Suggested Docker volume:

```yaml
volumes:
  - ./data/nms-bundles:/app/data/nms-bundles
  - ./data/nms-generated-pdfs:/app/data/nms-generated-pdfs
```

Run cleanup on each request or with a small interval/job:

```txt
delete files older than NMS_GENERATED_PDF_RETENTION_HOURS from:
  /app/data/nms-bundles
  /app/data/nms-generated-pdfs
```

## Guardrails

- Do not modify NMS numeric callback IDs.
- Do not change PageMint behavior for non-`cliffdemo3` publishers.
- Do not require PageMint auth changes unless a new API key is deliberately configured.
- Do not change existing PageMint browser export buttons.
- Do not change unrelated production domains or Docker services.

## Verification

1. Send a bundle from NMS for an API-enabled user.
2. Confirm PageMint stores the bundle.
3. Confirm PageMint generates a real PDF file.
4. Confirm PageMint posts it to NMS `/api/webhook/newspaper-pdf`.
5. Confirm NMS editor PDF API returns it for the numeric target user:

```txt
GET /api/editor/api-targets/<numeric-user-id>/pdfs
```

6. Confirm target user sees it in their own PDF tab.
7. Confirm old NMS/PageMint generated PDFs are removed after about 30 hours.
