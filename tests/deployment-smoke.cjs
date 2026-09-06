// Uses a fresh temporary database, never the workspace database or external AI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nms-smoke-'));
    const password = crypto.randomBytes(24).toString('hex');
    const child = spawn(process.execPath, ['server/index.js'], {
        env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, PORT: '0', HOST: '127.0.0.1',
            JWT_SECRET: crypto.randomBytes(32).toString('hex'), ADMIN_INITIAL_PASSWORD: password,
            ENABLE_NEWS_CLEANUP: 'false', GEMINI_API_KEY: '', DEEPSEEK_API_KEY: '' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    try {
        let port;
        for (let i = 0; i < 100; i++) {
            port = output.match(/localhost:(\d+)/)?.[1];
            if (port) break;
            if (child.exitCode !== null) throw new Error(output);
            await new Promise(r => setTimeout(r, 100));
        }
        assert.ok(port, output || 'Server did not start');
        const base = `http://127.0.0.1:${port}`;
        let token;
        const request = async (endpoint, method = 'GET', body, expected = 200) => {
            const form = body instanceof FormData;
            const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(!form ? { 'Content-Type': 'application/json' } : {}) };
            const res = await fetch(base + endpoint, { method, headers, body: body ? (form ? body : JSON.stringify(body)) : undefined });
            assert.equal(res.status, expected, `${method} ${endpoint}: ${res.status}`);
            return res;
        };
        await request('/api/health');
        await request('/api/auth/me', 'GET', undefined, 401);
        const adminToken = (await (await request('/api/auth/login', 'POST', { username: 'admin', password })).json()).token;
        assert.ok(adminToken);
        token = adminToken;
        const createUser = async (username, role) => {
            await request('/api/admin/users', 'POST', {
                username, password: 'test-password', full_name: `Test ${role}`, role
            });
            return (await (await request('/api/auth/login', 'POST', { username, password: 'test-password' })).json()).token;
        };
        const reporterToken = await createUser('smoke-reporter', 'reporter');
        const editorToken = await createUser('smoke-editor', 'editor');
        const operatorToken = await createUser('smoke-operator', 'operator');
        await request('/api/reporter/news', 'POST', { headline: 'Denied', body: 'Denied', category: 'local' }, 403);

        token = reporterToken;
        await request('/api/editor/news/raw', 'GET', undefined, 403);
        const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ0AAAAASUVORK5CYII=', 'base64');
        const form = new FormData();
        for (const [k, v] of Object.entries({ headline: 'Deployment test', body: 'A test article.', category: 'local', city: 'Test City' })) form.set(k, v);
        form.append('images', new Blob([bytes], { type: 'image/png' }), 'test.png');
        const article = await (await request('/api/reporter/news', 'POST', form)).json();
        assert.ok(article.id);
        token = editorToken;
        await request('/api/operator/news', 'GET', undefined, 403);
        const detail = await (await request(`/api/editor/news/${article.id}`)).json();
        assert.equal(detail.images.length, 1);
        await request(detail.image_path);
        await request(`/api/editor/news/${article.id}/approve`, 'PUT', { headline_rewritten: 'Edited test', body_rewritten: 'Edited test body.' });
        const retainedRaw = await (await request('/api/editor/news/raw')).json();
        assert.ok(retainedRaw.news.some(item => item.id === article.id && item.status === 'processed'));
        await request(`/api/editor/news/${article.id}/forward`, 'POST', {});
        token = operatorToken;
        await request('/api/admin/users', 'GET', undefined, 403);
        await request(`/api/operator/news/${article.id}/copy`, 'POST', {});
        const zip = await request(`/api/operator/news/${article.id}/images/zip`);
        assert.equal(zip.headers.get('content-type'), 'application/zip');
        assert.ok((await zip.arrayBuffer()).byteLength > 0);
        await request(`/api/operator/news/${article.id}/image`);
        token = reporterToken;
        const profile = new FormData();
        for (const k of ['full_name', 'name_hi', 'name_en', 'post', 'email', 'phone', 'city']) profile.set(k, 'Smoke test');
        profile.append('avatar', new Blob([bytes], { type: 'image/png' }), 'avatar.png');
        const updated = await (await request('/api/profile', 'PUT', profile)).json();
        await request(updated.profile.avatar_path);
        const removable = await (await request('/api/reporter/news', 'POST', {
            headline: 'Remove me', body: 'This raw article is used to test deletion.', category: 'local'
        })).json();
        token = editorToken;
        await request(`/api/editor/news/${removable.id}/delete`, 'POST', {});
        await request(`/api/editor/news/${removable.id}`, 'GET', undefined, 404);
        await request('/api/does-not-exist', 'GET', undefined, 404);
        assert.ok(fs.existsSync(path.join(dataDir, 'news.db')));
        console.log('PASS: fresh production startup, authentication, article workflow, image upload/download/ZIP, avatars, and API 404.');
    } finally {
        if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
        console.log('Isolated test data: ' + dataDir);
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
