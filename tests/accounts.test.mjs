import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from '../scripts/serve.mjs';

const password = 'una frase privata molto lunga';
async function setup(options = {}) {
    const server = createServer({ databasePath: ':memory:', ...options });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    async function request(route, { method = 'GET', body, cookie, csrf, origin = options.publicOrigin || url, headers = {} } = {}) {
        const result = await fetch(url + route, { method, headers: {
            ...(method !== 'GET' ? { Origin: origin } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers,
        }, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = await result.json();
        return { status: result.status, data, cookie: result.headers.get('set-cookie')?.split(';')[0], rawCookie: result.headers.get('set-cookie'), headers: result.headers };
    }
    const register = async (email = 'alice@example.test') => request('/api/auth/register', { method: 'POST', body: { name: 'Alice', email, password } });
    return { server, url, request, register, close: () => new Promise(resolve => server.close(resolve)) };
}

test('registration, real sessions, profile and logout', async () => {
    const app = await setup();
    try {
        assert.equal((await app.request('/api/dashboard')).status, 401);
        const registered = await app.register();
        assert.equal(registered.status, 201); assert.ok(registered.data.csrf);
        assert.match(registered.rawCookie, /HttpOnly; SameSite=Lax/);
        assert.equal(registered.headers.get('cache-control'), 'no-store');
        assert.equal(registered.data.user.email, 'alice@example.test');
        assert.equal(Object.hasOwn(registered.data.user, 'password_hash'), false);
        const auth = { cookie: registered.cookie, csrf: registered.data.csrf };
        const me = await app.request('/api/auth/me', auth);
        assert.equal(me.data.user.id, registered.data.user.id);
        assert.equal((await app.request('/api/account/profile', { ...auth, method: 'POST', body: { name: 'Alice aggiornata' } })).data.user.name, 'Alice aggiornata');
        assert.equal((await app.register('ALICE@example.test')).status, 409);
        const login = await app.request('/api/auth/login', { ...auth, method: 'POST', body: { email: 'alice@example.test', password } });
        assert.equal(login.status, 200); assert.notEqual(login.cookie, registered.cookie);
        assert.equal((await app.request('/api/dashboard', auth)).status, 401);
        const logged = { cookie: login.cookie, csrf: login.data.csrf };
        assert.equal((await app.request('/api/auth/logout', { ...logged, method: 'POST' })).status, 200);
        assert.equal((await app.request('/api/dashboard', logged)).status, 401);
    } finally { await app.close(); }
});

test('activity is private per account and refuses document metadata', async () => {
    const app = await setup();
    try {
        const a = await app.register(), b = await app.register('bob@example.test');
        const auth = { cookie: a.cookie, csrf: a.data.csrf, method: 'POST' };
        assert.equal((await app.request('/api/activity', { ...auth, body: { operation: 'metadata', filename: 'secret.pdf' } })).status, 400);
        assert.equal((await app.request('/api/activity', { ...auth, body: { operation: 'unexpected' } })).status, 400);
        assert.equal((await app.request('/api/activity', { ...auth, body: { operation: 'metadata' } })).status, 201);
        const dashboard = await app.request('/api/dashboard', { cookie: a.cookie });
        assert.equal(dashboard.data.stats.total, 1); assert.equal(dashboard.data.stats.last30Days, 1);
        assert.deepEqual(Object.keys(dashboard.data.recent[0]).sort(), ['createdAt', 'id', 'operation']);
        assert.equal((await app.request('/api/dashboard', { cookie: b.cookie })).data.stats.total, 0);
        await app.request('/api/activity/clear', { ...auth, body: {} });
        const cleared = await app.request('/api/dashboard', { cookie: a.cookie });
        assert.equal(cleared.data.recent.length, 0); assert.equal(cleared.data.stats.total, 0);
    } finally { await app.close(); }
});

test('CSRF, hostile origins, validation, request size and login throttling', async () => {
    const app = await setup();
    try {
        assert.equal((await app.request('/api/auth/register', { method: 'POST', origin: 'https://other.test', body: { name: 'Alice', email: 'alice@example.test', password } })).status, 403);
        assert.equal((await app.request('/api/auth/register', { method: 'POST', body: { name: 'Alice', email: 'bad', password } })).status, 400);
        assert.equal((await app.request('/api/auth/register', { method: 'POST', body: { name: 'Alice', email: 'alice@example.test', password: 'short' } })).status, 400);
        const registered = await app.register();
        assert.equal((await app.request('/api/account/profile', { method: 'POST', cookie: registered.cookie, body: { name: 'Bad' } })).status, 403);
        assert.equal((await app.request('/api/account/profile', { method: 'POST', cookie: registered.cookie, csrf: registered.data.csrf, body: { name: 'x'.repeat(9000) } })).status, 413);
        for (let attempt = 0; attempt < 10; attempt++) {
            assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: 'unknown@example.test', password: 'wrong-password' } })).status, 401);
        }
        assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: 'unknown@example.test', password: 'wrong-password' } })).status, 429);
    } finally { await app.close(); }
});

test('password change verifies old password and revokes every session', async () => {
    const app = await setup();
    try {
        const a = await app.register(), b = await app.request('/api/auth/login', { method: 'POST', body: { email: a.data.user.email, password } });
        const auth = { method: 'POST', cookie: a.cookie, csrf: a.data.csrf };
        assert.equal((await app.request('/api/account/password', { ...auth, body: { currentPassword: 'wrong', password: 'a new long secure password' } })).status, 400);
        assert.equal((await app.request('/api/account/password', { ...auth, body: { currentPassword: password, password: 'a new long secure password' } })).status, 200);
        assert.equal((await app.request('/api/dashboard', { cookie: a.cookie })).status, 401);
        assert.equal((await app.request('/api/dashboard', { cookie: b.cookie })).status, 401);
        assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: a.data.user.email, password } })).status, 401);
        assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: a.data.user.email, password: 'a new long secure password' } })).status, 200);
    } finally { await app.close(); }
});

test('accounts and sessions persist across restart; database stores hashes', async () => {
    await mkdir('test-results', { recursive: true });
    const directory = await mkdtemp(path.resolve('test-results/accounts-'));
    const databasePath = path.join(directory, 'accounts.sqlite');
    const first = await setup({ databasePath });
    const registered = await first.register(); await first.close();
    const db = new DatabaseSync(databasePath);
    const user = db.prepare('SELECT * FROM users').get(), storedSession = db.prepare('SELECT * FROM sessions').get();
    assert.notEqual(user.password_hash, password); assert.match(user.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.notEqual(storedSession.token_hash, registered.cookie.split('=')[1]); db.close();
    const second = await setup({ databasePath });
    try { assert.equal((await second.request('/api/auth/me', { cookie: registered.cookie })).data.user.id, registered.data.user.id); }
    finally { await second.close(); }
});

test('expired sessions denied; production cookies require HTTPS', async () => {
    let time = Date.now(); const app = await setup({ now: () => time });
    try {
        const registered = await app.register(); time += 8 * 86400000;
        assert.equal((await app.request('/api/dashboard', { cookie: registered.cookie })).status, 401);
    } finally { await app.close(); }
    assert.throws(() => createServer({ databasePath: ':memory:', secureCookies: true }));
    const secure = await setup({ secureCookies: true, publicOrigin: 'https://privatepdf.test' });
    try { assert.match((await secure.register()).rawCookie, /; Secure/); }
    finally { await secure.close(); }
});
