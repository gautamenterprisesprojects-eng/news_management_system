// Uses a fresh temporary database, never the workspace database or external AI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nms-smoke-'));
    const password = crypto.randomBytes(24).toString('hex');
    const receivedExternal = [];
    const externalServer = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/api/categories') {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                success: true,
                categories: [
                    { slug: 'national', isActive: true },
                    { slug: 'regional', isActive: true },
                    { slug: 'sports', isActive: true }
                ]
            }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            receivedExternal.push({ method: req.method, authorization: req.headers.authorization, body: JSON.parse(body) });
            res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                success: true,
                externalId: receivedExternal[0].body.externalId,
                hindiUrl: 'https://thecliffnews.in/hindi/smoke-test',
                created: true,
                updated: false,
                partial: true,
                status: 'PUBLISHED'
            }));
        });
    });
    await new Promise(resolve => externalServer.listen(0, '127.0.0.1', resolve));
    const externalPort = externalServer.address().port;
    const child = spawn(process.execPath, ['server/index.js'], {
        env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, PORT: '0', HOST: '127.0.0.1',
            JWT_SECRET: crypto.randomBytes(32).toString('hex'), ADMIN_INITIAL_PASSWORD: password,
            ENABLE_NEWS_CLEANUP: 'false', GEMINI_API_KEY: '', DEEPSEEK_API_KEY: '',
            EXTERNAL_NEWS_API_KEY: 'smoke-external-news-key', NMS_PUBLIC_BASE_URL: 'https://nms.test',
            EXTERNAL_NEWS_INGEST_URL: `http://127.0.0.1:${externalPort}/ingest`, EXTERNAL_NEWS_INGEST_API_KEY: 'smoke-ingest-key' },
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
        const forwardResponse = await (await request(`/api/editor/news/${article.id}/forward`, 'POST', {})).json();
        assert.deepEqual(forwardResponse.externalDelivery, {
            enabled: true,
            delivered: true,
            status: 201,
            externalId: `nms-${article.id}`,
            responseExternalId: `nms-${article.id}`,
            postedLinks: { hindiUrl: 'https://thecliffnews.in/hindi/smoke-test', englishUrl: null }
        });
        assert.equal(receivedExternal.length, 1);
        assert.equal(receivedExternal[0].method, 'POST');
        assert.equal(receivedExternal[0].authorization, 'Bearer smoke-ingest-key');
        assert.equal(receivedExternal[0].body.externalId, `nms-${article.id}`);
        assert.equal(receivedExternal[0].body.category, 'regional');
        assert.equal(receivedExternal[0].body.image.url, 'https://nms.test' + detail.image_path);
        const forwarded = await (await request('/api/editor/news/forwarded')).json();
        assert.ok(forwarded.news.some(item => item.id === article.id && item.external_hindi_url === 'https://thecliffnews.in/hindi/smoke-test'));
        const callbackResponse = await fetch(base + '/api/external-news/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer smoke-ingest-key' },
            body: JSON.stringify({
                externalId: `nms-${article.id}`,
                englishUrl: 'https://thecliffnews.in/english/smoke-test'
            })
        });
        assert.equal(callbackResponse.status, 200);
        assert.deepEqual(await callbackResponse.json(), { success: true, externalId: `nms-${article.id}` });
        const postedDetail = await (await request(`/api/editor/news/${article.id}`)).json();
        assert.equal(postedDetail.external_hindi_url, 'https://thecliffnews.in/hindi/smoke-test');
        assert.equal(postedDetail.external_english_url, 'https://thecliffnews.in/english/smoke-test');
        const missingCallbackResponse = await fetch(base + '/api/external-news/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer smoke-ingest-key' },
            body: JSON.stringify({
                externalId: 'nms-999999',
                hindiUrl: 'https://thecliffnews.in/hindi/missing-test'
            })
        });
        assert.equal(missingCallbackResponse.status, 404);
        assert.deepEqual(await missingCallbackResponse.json(), { success: false, error: 'Article not found' });
        const exportedResponse = await fetch(base + '/api/external-news/forwarded', {
            headers: { Authorization: 'Bearer smoke-external-news-key' }
        });
        assert.equal(exportedResponse.status, 200);
        const exported = await exportedResponse.json();
        const exportedArticle = exported.data.find(item => item.externalId === `nms-${article.id}`);
        assert.ok(exportedArticle);
        assert.equal(exportedArticle.title, 'Edited test');
        assert.equal(exportedArticle.body, 'Edited test body.');
        assert.equal(exportedArticle.reporterName, 'Test reporter');
        assert.equal(exportedArticle.place, 'Test City');
        assert.equal(exportedArticle.category, 'regional');
        assert.equal(exportedArticle.image.altText, 'Edited test');
        assert.match(exportedArticle.image.url, /\/uploads\//);
        token = operatorToken;
        await request('/api/admin/users', 'GET', undefined, 403);
        const operatorList = await (await request('/api/operator/news')).json();
        assert.ok(operatorList.news.some(item => item.id === article.id && item.external_english_url === 'https://thecliffnews.in/english/smoke-test'));
        await request(`/api/operator/news/${article.id}/copy`, 'POST', {});
        const zip = await request(`/api/operator/news/${article.id}/images/zip`);
        assert.equal(zip.headers.get('content-type'), 'application/zip');
        assert.ok((await zip.arrayBuffer()).byteLength > 0);
        await request(`/api/operator/news/${article.id}/image`);
        token = reporterToken;
        const reporterApproved = await (await request('/api/reporter/news/approved')).json();
        assert.ok(reporterApproved.news.some(item =>
            item.id === article.id
            && item.external_hindi_url === 'https://thecliffnews.in/hindi/smoke-test'
            && item.external_english_url === 'https://thecliffnews.in/english/smoke-test'
        ));
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
        await new Promise(resolve => externalServer.close(resolve));
        console.log('Isolated test data: ' + dataDir);
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
