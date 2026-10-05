import { api, sessionReady, setSession, session } from './account-session.js';
import { activityTypes } from './core/activity-types.js';
const $ = id => document.getElementById(id);
const date = timestamp => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
document.addEventListener('DOMContentLoaded', async () => {
    const current = await sessionReady;
    if (!current.available) { $('dashboard-status').textContent = 'Servizio account non disponibile. Riprova tra poco.'; return; }
    if (!current.user) { location.replace('/account.html'); return; }
    async function refresh() {
        const data = await api('/api/dashboard');
        $('dashboard-content').hidden = false; $('dashboard-status').textContent = '';
        $('greeting').textContent = `Ciao, ${data.user.name}.`; $('profile-name').value = data.user.name;
        $('profile-email').textContent = data.user.email;
        $('member-since').textContent = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(data.user.createdAt));
        $('total-operations').textContent = data.stats.total; $('month-operations').textContent = data.stats.last30Days;
        const list = $('activity-list'); list.replaceChildren();
        $('activity-empty').hidden = data.recent.length !== 0; $('clear-history').disabled = data.stats.total === 0;
        for (const item of data.recent) {
            const row = document.createElement('li'), label = document.createElement('strong'), time = document.createElement('time');
            label.textContent = activityTypes[item.operation] || 'Operazione PDF';
            time.dateTime = new Date(item.createdAt).toISOString(); time.textContent = date(item.createdAt); row.append(label, time); list.append(row);
        }
    }
    async function action(button, fn) {
        if (button.disabled) return;
        button.disabled = true; $('dashboard-status').textContent = '';
        try { await fn(); } catch (error) {
            if (error.status === 401) { location.replace('/account.html'); return; }
            $('dashboard-status').textContent = error.message;
        } finally { button.disabled = false; }
    }
    try { await refresh(); } catch (error) { $('dashboard-status').textContent = error.message; }
    $('logout').addEventListener('click', event => action(event.currentTarget, async () => {
        await api('/api/auth/logout', { method: 'POST' }); setSession({ user: null }); location.assign('/');
    }));
    $('refresh-dashboard').addEventListener('click', event => action(event.currentTarget, refresh));
    $('profile-form').addEventListener('submit', event => {
        event.preventDefault(); action($('save-profile'), async () => {
            const data = await api('/api/account/profile', { method: 'POST', body: { name: $('profile-name').value } });
            setSession({ ...session, user: data.user }); await refresh(); $('dashboard-status').textContent = 'Profilo aggiornato.';
        });
    });
    $('password-form').addEventListener('submit', event => {
        event.preventDefault(); action($('save-password'), async () => {
            if ($('new-password').value !== $('new-password-confirm').value) throw new Error('Le nuove password non coincidono.');
            await api('/api/account/password', { method: 'POST', body: { currentPassword: $('current-password').value, password: $('new-password').value } });
            $('password-form').reset(); setSession({ user: null }); location.assign('/account.html?passwordChanged=1');
        });
    });
    $('clear-history').addEventListener('click', () => $('history-confirmation').hidden = false);
    $('cancel-clear').addEventListener('click', () => $('history-confirmation').hidden = true);
    $('confirm-clear').addEventListener('click', event => action(event.currentTarget, async () => {
        await api('/api/activity/clear', { method: 'POST', body: {} }); $('history-confirmation').hidden = true; await refresh();
        $('dashboard-status').textContent = 'Cronologia e contatori cancellati.';
    }));
});
