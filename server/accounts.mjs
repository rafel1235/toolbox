import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { activityTypes } from '../src/js/core/activity-types.js';

const derive = promisify(scrypt);
const hashToken = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'privatepdf_session';
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const hashOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
let hashing = 0;
class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
function check(condition, status, message) { if (!condition) throw new HttpError(status, message); }
async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
    check(hashing < 4, 503, 'Il servizio è occupato. Riprova tra poco.');
    hashing++;
    try { return `${salt}:${(await derive(password, salt, 64, hashOptions)).toString('hex')}`; }
    finally { hashing--; }
}
async function verifyPassword(password, encoded) {
    const [salt, expected] = encoded.split(':');
    const [, actual] = (await passwordHash(password, salt)).split(':');
    return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
const dummyHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
function validatePassword(value) {
    check(typeof value === 'string' && value.length >= 12 && value.length <= 128 && Buffer.byteLength(value) <= 512, 400, 'La password deve contenere da 12 a 128 caratteri.');
    return value;
}
function validateName(value) {
    check(typeof value === 'string', 400, 'Inserisci il tuo nome.');
    const name = value.trim();
    check(name.length >= 2 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name), 400, 'Il nome deve contenere da 2 a 80 caratteri.');
    return name;
}
function validateEmail(value) {
    check(typeof value === 'string', 400, 'Inserisci un indirizzo email valido.');
    const email = value.trim().toLowerCase();
    check(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Inserisci un indirizzo email valido.');
    return email;
}
async function readJson(request) {
    check(/^application\/json(?:;|$)/i.test(request.headers['content-type'] || ''), 415, 'Richiesta JSON necessaria.');
    check(Number(request.headers['content-length'] || 0) <= 8192, 413, 'Richiesta troppo grande.');
    const chunks = []; let length = 0;
    for await (const chunk of request) {
        length += chunk.length; check(length <= 8192, 413, 'Richiesta troppo grande.'); chunks.push(chunk);
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Richiesta JSON non valida.'); }
    check(data && typeof data === 'object' && !Array.isArray(data), 400, 'Richiesta non valida.');
    return data;
}
function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, createdAt: user.created_at };
}

export function createAccounts({ databasePath, publicOrigin, secureCookies = false, now = Date.now } = {}) {
    check(!secureCookies || publicOrigin?.startsWith('https://'), 500, 'In produzione imposta PUBLIC_ORIGIN su un indirizzo HTTPS.');
    const location = databasePath || path.resolve('data/privatepdf.sqlite');
    if (location !== ':memory:') mkdirSync(path.dirname(location), { recursive: true });
    const db = new DatabaseSync(location);
    db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, operations_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            operation TEXT NOT NULL, created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activity_user_time ON activity(user_id, created_at DESC);
    `);
    const limits = new Map();
    let lastCleanup = 0;
    function rateLimit(key, maximum, windowMs = 15 * 60 * 1000) {
        const time = now();
        for (const [item, limit] of limits) if (limit.until <= time) limits.delete(item);
        let limit = limits.get(key);
        if (!limit) {
            check(limits.size < 10000, 503, 'Il servizio è occupato. Riprova tra poco.');
            limits.set(key, limit = { count: 0, until: time + windowMs });
        }
        check(++limit.count <= maximum, 429, 'Troppi tentativi. Riprova tra qualche minuto.');
    }
    function cleanup() {
        if (now() - lastCleanup < 60000) return;
        lastCleanup = now();
        db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
        db.prepare('DELETE FROM activity WHERE created_at < ?').run(now() - 90 * 86400000);
    }
    function send(response, status, data) {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        response.end(JSON.stringify(data));
    }
    function setCookie(response, token, maxAge) {
        response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`);
    }
    function tokenFrom(request) {
        const entry = (request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
        const token = entry?.slice(cookieName.length + 1) || '';
        return /^[a-f0-9]{64}$/.test(token) ? token : null;
    }
    function sessionFrom(request) {
        const token = tokenFrom(request);
        if (!token) return null;
        return db.prepare(`SELECT s.token_hash, s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(hashToken(token), now()) || null;
    }
    function createSession(user, response) {
        const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions (token_hash,user_id,csrf,expires_at) VALUES (?,?,?,?)').run(hashToken(token), user.id, csrf, now() + sessionDuration);
        // Bound the number of active sessions for each account.
        db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 10)').run(user.id, user.id);
        setCookie(response, token, sessionDuration / 1000);
        return { user: publicUser(user), csrf };
    }
    function transaction(action) {
        db.exec('BEGIN IMMEDIATE');
        try { const result = action(); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    const routes = new Set(['GET /api/auth/me', 'GET /api/dashboard', 'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/account/profile', 'POST /api/account/password', 'POST /api/activity', 'POST /api/activity/clear']);
    async function handle(request, response, pathname) {
        if (!pathname.startsWith('/api/')) return false;
        try {
            cleanup();
            const route = `${request.method} ${pathname}`;
            check(routes.has(route), 404, 'Endpoint non disponibile.');
            if (request.method !== 'GET') {
                const expectedOrigin = publicOrigin || `http://${request.headers.host}`;
                check(request.headers.origin === expectedOrigin && request.headers['sec-fetch-site'] !== 'cross-site', 403, 'Origine della richiesta non autorizzata.');
            }
            const session = sessionFrom(request);
            if (route === 'GET /api/auth/me') { send(response, 200, session ? { user: publicUser(session), csrf: session.csrf } : { user: null }); return true; }
            if (!['POST /api/auth/register', 'POST /api/auth/login'].includes(route)) {
                check(session, 401, 'Accedi per continuare.');
                if (request.method !== 'GET') check(request.headers['x-csrf-token'] === session.csrf, 403, 'Sessione non valida. Ricarica la pagina.');
            }
            if (route === 'GET /api/dashboard') {
                const recent = db.prepare('SELECT id,operation,created_at AS createdAt FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 20').all(session.id);
                const month = db.prepare('SELECT count(*) AS count FROM activity WHERE user_id=? AND created_at>=?').get(session.id, now() - 30 * 86400000).count;
                send(response, 200, { user: publicUser(session), stats: { total: session.operations_count, last30Days: month }, recent }); return true;
            }
            if (route === 'POST /api/auth/logout') {
                db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash); setCookie(response, '', 0);
                send(response, 200, { ok: true }); return true;
            }
            const ip = request.socket.remoteAddress || 'unknown';
            if (route === 'POST /api/auth/register') rateLimit(`register:${ip}`, 5);
            if (route === 'POST /api/auth/login') rateLimit(`login:${ip}`, 20);
            if (route === 'POST /api/account/password') rateLimit(`password:${session.id}`, 5);
            if (route === 'POST /api/activity') rateLimit(`activity:${session.id}`, 120, 60000);
            const data = await readJson(request);
            if (route === 'POST /api/auth/register') {
                const email = validateEmail(data.email), name = validateName(data.name), password = validatePassword(data.password);
                const encoded = await passwordHash(password);
                check(!db.prepare('SELECT id FROM users WHERE email=?').get(email), 409, 'Esiste già un account con questa email. Accedi.');
                const user = { id: randomUUID(), email, name, created_at: now() };
                const result = transaction(() => {
                    db.prepare('INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').run(user.id,email,name,encoded,user.created_at);
                    if (session) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
                    return createSession(user, response);
                });
                send(response, 201, result); return true;
            }
            if (route === 'POST /api/auth/login') {
                const email = validateEmail(data.email);
                check(typeof data.password === 'string' && data.password.length <= 128, 400, 'Inserisci la password.');
                rateLimit(`email:${hashToken(email)}`, 10);
                const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
                const valid = await verifyPassword(data.password, user?.password_hash || dummyHash);
                check(user && valid, 401, 'Email o password non corretti.');
                check(db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash === user.password_hash, 401, 'La password è cambiata. Accedi di nuovo.');
                if (session) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);
                send(response, 200, createSession(user, response)); return true;
            }
            if (route === 'POST /api/account/profile') {
                const name = validateName(data.name); db.prepare('UPDATE users SET name=? WHERE id=?').run(name,session.id);
                send(response, 200, { user: publicUser({ ...session, name }) }); return true;
            }
            if (route === 'POST /api/account/password') {
                const password = validatePassword(data.password);
                check(typeof data.currentPassword === 'string' && data.currentPassword.length <= 128, 400, 'Inserisci la password attuale.');
                check(await verifyPassword(data.currentPassword, session.password_hash), 400, 'La password attuale non è corretta.');
                const encoded = await passwordHash(password);
                transaction(() => {
                    const changed = db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').run(encoded,session.id,session.password_hash);
                    check(changed.changes === 1, 409, 'La password è già cambiata. Accedi di nuovo.');
                    db.prepare('DELETE FROM sessions WHERE user_id=?').run(session.id);
                });
                setCookie(response, '', 0); send(response, 200, { ok: true }); return true;
            }
            if (route === 'POST /api/activity') {
                check(typeof data.operation === 'string' && Object.hasOwn(activityTypes, data.operation), 400, 'Operazione non valida.');
                check(Object.keys(data).length === 1, 400, 'Invia solo il tipo di operazione, senza dati del documento.');
                transaction(() => {
                    db.prepare('INSERT INTO activity (user_id,operation,created_at) VALUES (?,?,?)').run(session.id,data.operation,now());
                    db.prepare('UPDATE users SET operations_count=operations_count+1 WHERE id=?').run(session.id);
                });
                send(response, 201, { ok: true }); return true;
            }
            if (route === 'POST /api/activity/clear') {
                transaction(() => { db.prepare('DELETE FROM activity WHERE user_id=?').run(session.id); db.prepare('UPDATE users SET operations_count=0 WHERE id=?').run(session.id); });
                send(response, 200, { ok: true }); return true;
            }
        } catch (error) {
            if (!error.status) console.error('Account API error:', error.message);
            send(response, error.status || 500, { error: error.status ? error.message : 'Errore del servizio. Riprova tra poco.' });
        }
        return true;
    }
    return { handle, close: () => db.close() };
}
