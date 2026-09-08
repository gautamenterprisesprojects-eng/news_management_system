const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { dataDir } = require('../storage');
const dbPath = path.join(dataDir, 'news.db');

let db = null;

function migrateUsersRoleConstraint() {
    const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    if (!table?.sql) return;
    // Trigger when sub_editor or ad_manager is missing from the CHECK constraint
    if (table.sql.includes("'sub_editor'") && table.sql.includes("'ad_manager'")) return;

    db.transaction(() => {
        db.exec(`
            CREATE TABLE users_next (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                name_hi TEXT,
                name_en TEXT,
                post TEXT,
                avatar_path TEXT,
                email TEXT,
                phone TEXT,
                city TEXT,
                district TEXT,
                assigned_sub_editor_id INTEGER,
                assigned_editor_id INTEGER,
                is_api_enabled INTEGER DEFAULT 0,
                print_designation TEXT,
                role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'reporter', 'operator', 'sub_editor', 'ad_manager')),
                status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
                created_by INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        const oldColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
        const copyColumns = [
            'id', 'username', 'password_hash', 'full_name', 'name_hi', 'name_en', 'post',
            'avatar_path', 'email', 'phone', 'city', 'district', 'assigned_sub_editor_id',
            'assigned_editor_id', 'is_api_enabled', 'print_designation',
            'role', 'status', 'created_by', 'created_at'
        ].filter(name => oldColumns.has(name));

        db.prepare(`INSERT INTO users_next (${copyColumns.join(', ')}) SELECT ${copyColumns.join(', ')} FROM users`).run();
        db.exec('DROP TABLE users');
        db.exec('ALTER TABLE users_next RENAME TO users');
    })();
}

/**
 * Initialize the database — must be called once before using `getDb()`
 * Uses better-sqlite3 with a persistent data directory.
 */
async function initDatabase() {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // ============================================================
    // TABLE: users
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            name_hi TEXT,
            name_en TEXT,
            post TEXT,
            avatar_path TEXT,
            email TEXT,
            phone TEXT,
            city TEXT,
            district TEXT,
            assigned_sub_editor_id INTEGER,
            assigned_editor_id INTEGER,
            is_api_enabled INTEGER DEFAULT 0,
            print_designation TEXT,
            role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'reporter', 'operator', 'sub_editor', 'ad_manager')),
            status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);

    // ============================================================
    // TABLE: news
    // Status flow: raw → processing → processed → forwarded
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            headline TEXT NOT NULL,
            body TEXT NOT NULL,
            headline_rewritten TEXT,
            body_rewritten TEXT,
            image_path TEXT,
            selected_image_path TEXT,
            category TEXT NOT NULL,
            tags TEXT,
            city TEXT,
            reporter_id INTEGER NOT NULL,
            editor_id INTEGER,
            status TEXT DEFAULT 'raw' CHECK(status IN ('raw','processing','processed','forwarded','rejected','published')),
            ai_provider TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            processed_at TEXT,
            forwarded_at TEXT,
            published_at TEXT,
            external_hindi_url TEXT,
            external_english_url TEXT,
            external_posted_at TEXT,
            rejected_at TEXT,
            rejected_by INTEGER,
            reject_reason TEXT
        )
    `);

    // ============================================================
    // TABLE: news_images — multiple images per article
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            news_id INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            is_selected INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            uploaded_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);

    // ============================================================
    // TABLE: api_pdfs
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS api_pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_user_id INTEGER NOT NULL,
            pdf_url TEXT NOT NULL,
            filename TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);

    migrateUsersRoleConstraint();

    // Check the schema explicitly; do not hide failed migrations as duplicate columns.
    const additions = {
        users: {
            avatar_path: 'TEXT',
            email: 'TEXT',
            phone: 'TEXT',
            city: 'TEXT',
            district: 'TEXT',
            assigned_sub_editor_id: 'INTEGER',
            assigned_editor_id: 'INTEGER',
            is_api_enabled: 'INTEGER DEFAULT 0',
            print_designation: 'TEXT',
            name_hi: 'TEXT',
            name_en: 'TEXT',
            post: 'TEXT'
        },
        news: {
            rejected_at: 'TEXT',
            rejected_by: 'INTEGER',
            reject_reason: 'TEXT',
            selected_image_path: 'TEXT',
            published_at: 'TEXT',
            external_hindi_url: 'TEXT',
            external_english_url: 'TEXT',
            external_posted_at: 'TEXT',
            sub_editor_id: 'INTEGER',
            sub_editor_status: "TEXT DEFAULT 'direct'",
            sub_editor_forwarded_at: 'TEXT',
            sub_editor_rejected_at: 'TEXT',
            sub_editor_reject_reason: 'TEXT',
            newspaper_sent_at: 'TEXT'
        },
        news_images: { sort_order: 'INTEGER DEFAULT 0' }
    };
    db.transaction(() => {
        for (const [table, columns] of Object.entries(additions)) {
            const existing = new Set(db.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name));
            for (const [name, type] of Object.entries(columns)) {
                if (!existing.has(name)) db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + type);
            }
        }
    })();

    // ============================================================
    // TABLE: news_copies
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS news_copies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            news_id INTEGER NOT NULL,
            operator_id INTEGER NOT NULL,
            copied_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);

    // ============================================================
    // TABLE: advertisements
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS advertisements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sub_editor_id INTEGER NOT NULL,
            editor_id INTEGER,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            ad_type TEXT NOT NULL CHECK(ad_type IN ('website','print_edition')),
            note_sub_editor TEXT,
            note_editor TEXT,
            size TEXT,
            price TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','sent_to_operator')),
            created_at TEXT DEFAULT (datetime('now','localtime')),
            approved_at TEXT,
            rejected_at TEXT,
            reject_reason TEXT
        )
    `);

    // ============================================================
    // TABLE: settings
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    // ============================================================
    // TABLE: push_subscriptions
    // ============================================================
    db.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            endpoint TEXT UNIQUE NOT NULL,
            subscription_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    `);

    // ============================================================
    // INDEXES
    // ============================================================
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_status ON news(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_reporter ON news(reporter_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_copies_news ON news_copies(news_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_assigned_sub_editor ON users(assigned_sub_editor_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_assigned_editor ON users(assigned_editor_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_sub_editor ON news(sub_editor_id, sub_editor_status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_news_images_order ON news_images(news_id, sort_order, id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ads_sub_editor ON advertisements(sub_editor_id, status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ads_editor ON advertisements(editor_id, status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ads_created_at ON advertisements(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_api_pdfs_target ON api_pdfs(target_user_id, created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_api_pdfs_created_at ON api_pdfs(created_at)`);

    // ============================================================
    // SEED: Default admin account (admin / admin123)
    // ============================================================
    const existingAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (!existingAdmin) {
        const password = process.env.ADMIN_INITIAL_PASSWORD;
        if (process.env.NODE_ENV === 'production' && (!password || password.length < 16)) {
            throw new Error('Set ADMIN_INITIAL_PASSWORD to at least 16 characters for a fresh production database.');
        }
        const hash = bcrypt.hashSync(password || 'admin123', 10);
        db.prepare(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
        ).run('admin', hash, 'Master Admin', 'admin');
        console.log('Default admin created');
    }

    // ============================================================
    // SEED: Default settings
    // ============================================================
    const defaultSettings = [
        ['ai_provider', 'gemini'],
        ['gemini_api_key', process.env.GEMINI_API_KEY || ''],
        ['gemini_model', process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'],
        ['deepseek_api_key', process.env.DEEPSEEK_API_KEY || ''],
        ['ai_rewrite_prompt', 'You are a professional news editor. Rewrite the following news article to be clear, concise, and professionally written. Maintain all factual accuracy. Keep the same language as the input (Hindi or English). Return ONLY a JSON object with two fields: "headline" (rewritten headline) and "body" (rewritten article body). Do not include any other text or markdown formatting.']
    ];

    for (const [key, value] of defaultSettings) {
        const exists = db.prepare(`SELECT key FROM settings WHERE key = '${key}'`).get();
        if (!exists) {
            db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
        }
    }

    // Save to disk


    console.log('✅ Database initialized successfully');
    return db;
}

/**
 * Save database to disk — call after any write operation
 */
function saveDatabase() { }

/**
 * Get the database instance
 * Must call initDatabase() first
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Helper: Execute a SELECT query and return array of row objects
 * sql.js returns { columns: [...], values: [[...]] } format
 * This converts it to [{ col1: val1, col2: val2 }, ...]
 */
function queryAll(sql, params = []) {
    return db.prepare(sql).all(...params);
}

/**
 * Helper: Execute a SELECT query and return first row as object, or null
 */
function queryGet(sql, params = []) {
    return db.prepare(sql).get(...params) || null;
}

/**
 * Helper: Execute an INSERT/UPDATE/DELETE and return { changes, lastInsertRowid }
 */
function queryRun(sql, params = []) {
    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

module.exports = { initDatabase, getDb, saveDatabase, queryAll, queryGet, queryRun };
