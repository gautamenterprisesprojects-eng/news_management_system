# NMS Continuation Context

Date: 2026-09-07
Project: News Management System (NMS)
Workspace: c:\Users\hp\Desktop\teste

---

## 1) Project purpose
This project is a bilingual news management system for a newsroom workflow. It supports:
- Reporter submissions
- Editor review and AI-assisted rewriting
- Operator publishing/copy workflow
- Admin user management and AI configuration
- Public/external news export flow
- Hindi + English UI

Main app entry:
- server/index.js
- public/index.html
- public/js/pages/*.js

---

## 2) Current working state
As of today, these files are modified in the workspace:
- .env.example
- public/css/styles.css
- public/index.html
- public/js/pages/editor.js
- server/index.js
- server/routes/editor.js
- tests/deployment-smoke.cjs
- server/routes/externalNews.js (new/untracked)

This means the project is actively being updated for workflow polish and external/news export functionality.

---

## 3) What is already implemented
### Core app
- Express backend with static frontend serving
- JWT authentication and role-based access
- SQLite database initialization and storage handling
- Upload support for article images and avatars
- Background cleanup job for old news entries (48h retention toggle)

### Reporter workflow
- Submit news with headline, body, category, tags, city, image
- View personal submission history
- Profile management with avatar update

### Editor workflow
- Raw news list and processed news list
- AI rewrite support via Gemini / DeepSeek
- Approve / forward / reject flows
- Keep processed entries visible in raw list for history
- Edited article publishing path and forwarding state support

### Operator workflow
- Forwarded news queue
- Copy tracking and visual state indicators
- Download article image or ZIP package

### Admin workflow
- User management
- AI provider, API key, model, prompt configuration
- Dashboard stats

### External/public export
- New external news forwarding route exists and is referenced in the app
- Exported data includes title, body, reporter name, place, and image URL metadata

### UI/design
- Editorial branded styling with orange theme
- Glassmorphism/card-based layout
- Hindi and English translation wiring

---

## 4) Important runtime details
### Commands
Install dependencies:
```bash
npm install
```

Run the app:
```bash
npm start
```

Run in dev mode:
```bash
npm run dev
```

### Environment
Copy `.env.example` to `.env` and fill values:
```env
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
DEEPSEEK_API_KEY=
DEFAULT_AI_PROVIDER=gemini
ENABLE_NEWS_CLEANUP=false
EXTERNAL_NEWS_API_KEY=generate-a-long-random-secret
NMS_PUBLIC_BASE_URL=
NMS_EXTERNAL_SOURCE=The Cliff News NMS
```

Important:
- `ENABLE_NEWS_CLEANUP` is currently set to false in the example config
- `EXTERNAL_NEWS_API_KEY` is needed for the external-news forwarding API
- `NMS_PUBLIC_BASE_URL` matters for exported image/public URLs

### Default login credentials
- Admin: `admin` / `admin123`
- Reporter: `reporter1` / `1234`
- Editor: `editor1` / `1234`
- Operator: `operator1` / `1234`

---

## 5) Files to check first when resuming work
1. server/index.js
   - Express app startup
   - route registration
   - cleanup cron and API fallback

2. server/routes/editor.js
   - editor news flow
   - raw/processed/forwarded/published endpoints
   - select image and AI rewrite logic

3. public/js/pages/editor.js
   - front-end editor UI and actions
   - split pane logic, data loading, modal actions

4. server/routes/externalNews.js
   - external/public export flow
   - may be newly added and needs validation

5. tests/deployment-smoke.cjs
   - production smoke test covering startup, auth, reporter/editor/operator flow, external API, images, and zip download

6. public/css/styles.css
   - branding/theme and layout updates

---

## 6) Current feature/bug notes worth remembering
### Editor raw history behavior
The raw list intentionally keeps processed items visible so history is not lost after approval. The code comments mention this as an intentional workflow rule.

### Background cleanup
Cleanup is configured through:
```js
if (process.env.ENABLE_NEWS_CLEANUP === 'true')
```
This is optional and currently false by default in `.env.example`.

### External news export
The app exposes a protected external endpoint:
- /api/external-news/forwarded
Protected by a long shared secret key via `EXTERNAL_NEWS_API_KEY`.

### Deployment smoke test
The smoke test creates a temporary isolated DB and validates:
- fresh startup
- auth flows
- reporter submission
- editor approval and forwarding
- external API export
- operator copy + image ZIP generation
- profile upload
- delete flow
- 404 handling

This is a useful regression guard when continuing work.

---

## 7) Likely next steps if continuing from here
1. Confirm `.env` is configured correctly before running the app.
2. Start the server and verify `/api/health` works.
3. Log in as admin and verify the app loads the dashboard.
4. Check the editor workflow end-to-end:
   - raw item appears
   - rewrite works
   - approve works
   - forward works
5. Check operator flow:
   - forwarded item appears
   - copy action updates state
   - image zip/download works
6. Validate external export route with the shared API key.
7. Run the smoke test:
```bash
node tests/deployment-smoke.cjs
```
8. If UI issues remain, inspect public/js/pages/editor.js and public/css/styles.css first.

---

## 8) Best resume message to continue later
If you want to resume in a future chat, you can say:

"continue from NMS continuation context"

Then pick up from the next steps above.

---

## 9) Quick sanity checklist before finalizing changes
- [ ] .env created from .env.example
- [ ] JWT secret set
- [ ] Gemini/DeepSeek keys configured if needed
- [ ] external-news key set if export is in use
- [ ] app runs without startup errors
- [ ] editor raw/processed flow still works
- [ ] operator copy workflow still works
- [ ] smoke test passes

---

## 10) Summary
The project is in a functional newsroom-management state with additional work around editor retention, public export, and deployment validation. The most relevant files for continuation are the backend entry point, editor route, editor UI, external export route, and smoke test.

If you need to continue later, start by checking the exact files above and re-running the smoke test before making more changes.
