# News Management System (NMS) — समाचार प्रबंधन प्रणाली

A comprehensive, full-featured multi-panel news publishing workflow platform built with Node.js, Express, SQLite, and vanilla CSS/JS. Includes AI-powered news rewriting using **Google Gemini 3.1 Flash Lite** (and DeepSeek), bilingual Hindi & English UI, and role-based workflows for reporters, editors, operators, and administrators.

---

## 🌟 Key Features

1. **📱 Reporter Panel (`#/reporter`)**
   - Submit fresh news with headline, full article body, category, tags, and city.
   - Upload article images (stored in `/uploads/` with UUID-based filenames).
   - View history and status of own submissions.

2. **✏️ Editor Panel (`#/editor`)**
   - **Split Screen Layout**: Raw incoming news on the left, processed news on the right.
   - Full article modal reader with high-resolution image viewing.
   - **AI Rewriter**: One-click rewrite using **Google Gemini 3.1 Flash Lite** (or DeepSeek) to convert raw drafts into professional news copy while preserving factual integrity.
   - Review rewritten headline and body with side-by-side comparison.
   - Edit, approve, and forward news to the operator queue.

3. **📋 Operator Panel (`#/operator`)**
   - View queue of approved news ready for publishing.
   - Copy headline or full article text to clipboard with a single click.
   - Download article images.
   - **Visual State Tracking**: Once an operator copies an article, the card is visually greyed out and tagged with a badge showing *"Copied by [Operator Name]"*, preventing duplicate work while still allowing re-copying if necessary.

4. **👑 Admin Panel (`#/admin`)**
   - System overview with live stats (total news, raw, processed, forwarded, user counts).
   - **User Management**: Create, view, edit, and deactivate accounts for Reporters, Editors, and Operators.
   - **AI Configuration**: Configure active provider (Gemini or DeepSeek), API keys, model identifier (e.g. `gemini-3.1-flash-lite`), and customize the rewriting prompt directly from the UI.

5. **🌐 Bilingual & Glassmorphic UI**
   - Instant toggle between Hindi (हिंदी) and English.
   - Mobile-first responsive layout with bottom navigation tabs and sleek dark glassmorphism styling.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` and configure your own secrets:
```env
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite
DEEPSEEK_API_KEY=
DEFAULT_AI_PROVIDER=gemini
```

### 3. Start the Server
```bash
node server/index.js
```
Open your browser at `http://localhost:3000`.

---

## 👥 Default Login Credentials

| Role | Username | Password | Access Panel |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `#/admin` |
| **Reporter** | `reporter1` | `1234` | `#/reporter` |
| **Editor** | `editor1` | `1234` | `#/editor` |
| **Operator** | `operator1` | `1234` | `#/operator` |

*(Additional accounts can be created at any time through the Admin panel or API).*

---

## 📂 Project Structure

```
teste/
├── .env                       # Environment configuration (API keys, ports, secrets)
├── package.json               # Node.js dependencies and scripts
├── database.sqlite            # SQLite database file (auto-saved on changes)
├── uploads/                   # Uploaded news images directory
├── docs/
│   └── ARCHITECTURE.md        # Deep-dive guide for AI agents and developers
├── server/
│   ├── index.js               # Express application entry point & route registration
│   ├── db/
│   │   └── init.js            # SQLite database schema, sql.js wrapper & seed data
│   ├── middleware/
│   │   └── auth.js            # JWT verification and role-based access control
│   ├── services/
│   │   └── aiRewriter.js      # Gemini (gemini-3.1-flash-lite) & DeepSeek integration
│   └── routes/
│       ├── auth.js            # Login & auth validation endpoints
│       ├── reporter.js        # Reporter submission & history endpoints
│       ├── editor.js          # Raw/processed news, AI rewrite & forward endpoints
│       ├── operator.js        # Forwarded news, copy tracking & download endpoints
│       └── admin.js           # User CRUD, stats, and AI settings endpoints
└── public/
    ├── index.html             # Single-page application root HTML
    ├── css/
    │   └── style.css          # Glassmorphic dark design system & responsive layout
    └── js/
        ├── app.js             # SPA hash router, auth state, and API wrapper
        ├── i18n.js            # Bilingual dictionary (Hindi & English)
        ├── components/
        │   ├── navbar.js      # Top app bar and bottom role navigation
        │   └── modal.js       # Article reader, toast alerts, confirmation dialogs
        └── pages/
            ├── login.js       # Login interface
            ├── reporter.js    # News submission form & personal submissions list
            ├── editor.js      # Split-screen raw/processed news with AI rewrite
            ├── operator.js    # News feed with copy actions and grey-out badges
            └── admin.js       # Stats dashboard, user manager, AI settings editor
```

---

## 🤖 AI Rewriting Configuration

The system uses **Google Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`) via Google Generative Language API.

- **Changing AI Model**: In Admin Panel → Settings → Gemini Model, enter any supported model (e.g. `gemini-3.1-flash-lite`, `gemini-2.5-flash`, etc.) and click **Save Settings**.
- **Changing AI Prompt**: The prompt can be modified directly in Admin Panel → Settings. The AI rewriter expects a clean JSON response containing `headline` and `body`.

---

## 🛠️ API Reference

- `POST /api/auth/login` - Authenticate and receive JWT token
- `GET /api/auth/me` - Get current authenticated user details
- `POST /api/reporter/news` - Submit news (supports `multipart/form-data` with `image`)
- `GET /api/reporter/news/my` - Get news submitted by logged-in reporter
- `GET /api/editor/news/raw` - Get list of raw news pending editor review
- `GET /api/editor/news/processed` - Get list of news rewritten by AI
- `GET /api/editor/news/:id` - Get full details of a specific news article
- `POST /api/editor/news/:id/rewrite` - Trigger AI rewrite with Gemini 3.1 Flash Lite
- `POST /api/editor/news/:id/approve` - Approve rewritten news and move to processed
- `POST /api/editor/news/:id/forward` - Forward processed news to operator queue
- `GET /api/operator/news` - Get all forwarded news items with copy status badges
- `POST /api/operator/news/:id/copy` - Mark article as copied by current operator
- `GET /api/admin/stats` - Summary counts for dashboard cards
- `GET /api/admin/users` - List all users (filter by `?role=...`)
- `POST /api/admin/users` - Create a new user (reporter, editor, operator, admin)
- `PUT /api/admin/users/:id` - Update user details or reset password
- `DELETE /api/admin/users/:id` - Deactivate a user
- `GET /api/admin/settings` - Retrieve current system settings
- `PUT /api/admin/settings` - Update AI provider, API keys, model, or prompt

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the staged GitHub, Vercel frontend, and Hostinger backend setup.
