# Architecture & Developer Guide — News Management System (NMS)

This document is written for AI agents and human engineers who need to understand, maintain, debug, or extend the News Management System codebase quickly and effectively.

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |         CLIENT (SPA)        |
                      |   Vanilla JS + CSS System   |
                      +--------------+--------------+
                                     |
                                REST API
                               (JSON/Auth)
                                     |
                      +--------------v--------------+
                      |       EXPRESS BACKEND       |
                      |      Node.js Server         |
                      +-------+--------------+------+
                              |              |
                    +---------v---+    +-----v---------+
                    | SQLite DB   |    | AI Services   |
                    | (better-   |    | Gemini /      |
                    | sqlite3)    |    | DeepSeek      |
                    +-------------+    +---------------+
```

- **Backend:** Node.js + Express.js
- **Database:** `better-sqlite3`. (Recently upgraded from `sql.js` for massive performance and RAM savings. It uses native C++ disk operations and WAL mode).
- **Frontend:** Pure Vanilla JavaScript (SPA - Single Page Application), Vanilla CSS (Custom properties, CSS grid/flexbox), HTML5. **No frontend frameworks** (No React, Vue, or Tailwind).
- **Authentication:** JWT (JSON Web Tokens) passed via the `Authorization: Bearer <token>` header.
- **Performance:** Express `compression` middleware (Gzip/Brotli) and Static Asset Caching (`maxAge: 30d`) are enabled for maximum speed.

---

## 2. Core Workflows by Role

The system is a 4-panel News Management System.

### A. Admin (एडमिन)
- **Endpoint:** `/api/admin/*`
- **Frontend:** `public/js/pages/admin.js`
- **Role:** Full system control. Can create/edit/delete users (Reporters, Editors, Operators).
- **Key Feature:** Controls the AI Settings (`/api/admin/settings`) where they set the Gemini/DeepSeek API keys and the specific System Prompt used for rewriting news.

### B. Reporter (रिपोर्टर)
- **Endpoint:** `/api/reporter/*`
- **Frontend:** `public/js/pages/reporter.js`
- **Role:** Submits raw news from the field.
- **Workflow:** 
  1. Fills out Headline, Body, Category, City.
  2. Uploads an image (handled by `multer` in backend).
  3. Submitted news is saved to the database with `status = 'raw'`.

### C. Editor (संपादक)
- **Endpoint:** `/api/editor/*`
- **Frontend:** `public/js/pages/editor.js`
- **Role:** Reviews raw news, rewrites it using AI, and publishes it.
- **Workflow:**
  1. **Raw News (कच्ची खबरें):** Editor sees all `status = 'raw'` news. They can trigger an AI Rewrite (Hindi or English).
  2. **AI Rewriter (`server/services/aiRewriter.js`):** Calls Gemini or DeepSeek API to rewrite the headline and body professionally.
  3. **Approve:** Once satisfied, the Editor approves it. Status changes to `published`.
  4. **Published News (प्रकाशित खबरें):** Editor can see all published news. *Note: Pagination is implemented here (`?page=1`, `LIMIT 20 OFFSET ?`) with a "Load More" button.*
  5. **Tracking Activity:** The Published tab tracks exactly which Operator copied the news and at what time (Live Activity).

### D. Operator (ऑपरेटर)
- **Endpoint:** `/api/operator/*`
- **Frontend:** `public/js/pages/operator.js`
- **Role:** Views published news and forwards/downloads them to post on social media or portals.
- **Workflow:**
  1. Can view `status = 'published'` news.
  2. When they click "पूरी खबर पढ़ें" (Read Full), a Modal pops up.
  3. Clicking "Copy" copies the text to the clipboard and logs a record in the `news_copies` table linking their Operator ID to the News ID.

---

## 3. Database Architecture (`server/db/init.js`)

The project uses `better-sqlite3` natively compiled driver. 

### Schema Design

#### `users` Table
Stores user accounts with bcrypt password hashes.
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'reporter', 'editor', 'operator')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

#### `news` Table
Stores articles and tracks lifecycle states.
```sql
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    headline_rewritten TEXT,
    body_rewritten TEXT,
    image_path TEXT,
    category TEXT NOT NULL,
    tags TEXT,
    city TEXT,
    reporter_id INTEGER NOT NULL,
    editor_id INTEGER,
    status TEXT DEFAULT 'raw' CHECK(status IN ('raw', 'processing', 'processed', 'forwarded', 'published', 'rejected')),
    ai_provider TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    processed_at TEXT,
    forwarded_at TEXT
);
```

#### `news_copies` Table
Tracks which operators have copied which articles.
```sql
CREATE TABLE IF NOT EXISTS news_copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    copied_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

#### `settings` Table
Key-value configuration store for AI models, API keys, and custom prompts.
```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 4. Frontend SPA Mechanics (`public/js/app.js`)

- **Routing:** Handled manually via `#` hash routing (e.g., `#/editor`, `#/reporter`). The `router()` function in `app.js` listens to `hashchange` and loads the respective script.
- **Modals:** `public/js/components/modal.js` handles all popups globally via `showArticleModal(options)`. It is built to be responsive and has sticky headers/footers for mobile scrolling.
- **State:** Each page script (e.g., `editor.js`) manages its own local state (like `_rawPage`, `_hasMoreRaw`) for pagination and filtering.

---

## 5. Background Jobs

- **48-Hour Cleanup (`server/index.js`):** A `setInterval` job runs every 60 minutes. It scans the `news` table for articles older than 48 hours, permanently deletes their associated image files from the hard drive, and completely removes the rows from the database. This keeps the system incredibly lightweight and prevents disk space issues.

---

## 6. Important Notes for Future Development

- **No Frontend Build Step:** We do not use Webpack, Vite, or Babel. Javascript is served raw to the browser.
- **Backend Pagination:** When adding new features to Editor or Operator tabs, ensure queries use `LIMIT 20 OFFSET ?` combined with the "Load More" frontend logic to prevent massive RAM spikes.
- **Database Helper Methods:** Stick to standard `better-sqlite3` execution patterns (`db.prepare(sql).run()`, `.all()`, `.get()`). DO NOT introduce async/await ORMs or heavy libraries like Sequelize.
- **File Uploads:** Always handled via `multer` in the backend. Ensure files are deleted from `/uploads` when deleting database records (as done in the 48-hour cleanup).
