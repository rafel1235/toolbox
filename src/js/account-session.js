export let session = { user: null, csrf: null, available: true };
export async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && session.csrf) headers['X-CSRF-Token'] = session.csrf;
    let response;
    try { response = await fetch(path, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Connessione al servizio account non disponibile. Riprova tra poco.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('Il servizio account non è disponibile. Avvia il server PrivatePDF.'); }
    if (!response.ok) { const error = new Error(data.error || 'Operazione non riuscita.'); error.status = response.status; throw error; }
    return data;
}
export function setSession(data) { session = { ...data, available: true }; renderNavigation(); }
export const sessionReady = api('/api/auth/me').then(data => { setSession(data); return session; }).catch(() => {
    session = { user: null, csrf: null, available: false }; return session;
});
function renderNavigation() {
    const nav = document.getElementById('account-nav');
    if (!nav) return;
    nav.replaceChildren();
    const links = session.user ? [['Dashboard', '/dashboard.html'], [session.user.name, '/dashboard.html#profile']] : [['Accedi', '/account.html'], ['Crea account', '/account.html?mode=register']];
    for (const [label, href] of links) { const link = document.createElement('a'); link.textContent = label; link.href = href; nav.append(link); }
}
document.addEventListener('DOMContentLoaded', () => { renderNavigation(); sessionReady.then(renderNavigation); });
let activityQueue = Promise.resolve();
// Only operation names reach the server; document data and filenames stay local.
document.addEventListener('privatepdf:activity', event => {
    if (!session.user) return;
    const operation = event.detail.operation;
    activityQueue = activityQueue.then(() => api('/api/activity', { method: 'POST', body: { operation } })).catch(() => {});
});
