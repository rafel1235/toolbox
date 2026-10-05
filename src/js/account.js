import { api, sessionReady, setSession } from './account-session.js';
const $ = id => document.getElementById(id);
document.addEventListener('DOMContentLoaded', async () => {
    const current = await sessionReady;
    if (current.user) { location.replace('/dashboard.html'); return; }
    const register = new URLSearchParams(location.search).get('mode') === 'register';
    $('account-title').textContent = register ? 'Il tuo spazio, in privato.' : 'Bentornato.';
    $('account-description').textContent = register ? 'Crea il tuo account gratuito e ritrova le tue attività in un unico posto.' : 'Accedi alla tua dashboard PrivatePDF.';
    $('register-fields').hidden = !register; $('account-name').disabled = !register;
    $('confirm-password').disabled = !register; $('confirm-field').hidden = !register;
    $('account-password').minLength = register ? 12 : 1;
    $('account-password').autocomplete = register ? 'new-password' : 'current-password';
    $('submit-account').textContent = register ? 'Crea account' : 'Accedi';
    $('account-switch').textContent = register ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati';
    $('account-switch').href = register ? '/account.html' : '/account.html?mode=register';
    $('show-password').addEventListener('click', () => {
        const visible = $('account-password').type === 'password';
        $('account-password').type = $('confirm-password').type = visible ? 'text' : 'password';
        $('show-password').textContent = visible ? 'Nascondi password' : 'Mostra password';
        $('show-password').setAttribute('aria-pressed', String(visible));
    });
    if (!current.available) $('account-status').textContent = 'Il servizio account non è disponibile. Il toolbox resta accessibile.';
    if (new URLSearchParams(location.search).has('passwordChanged')) $('account-status').textContent = 'Password aggiornata. Accedi con la nuova password.';
    $('account-form').addEventListener('submit', async event => {
        event.preventDefault(); const button = $('submit-account'); if (button.disabled) return;
        $('account-status').textContent = '';
        if (register && $('account-password').value !== $('confirm-password').value) { $('account-status').textContent = 'Le password non coincidono.'; return; }
        button.disabled = true;
        try {
            const body = { email: $('account-email').value, password: $('account-password').value };
            if (register) body.name = $('account-name').value;
            const data = await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body });
            $('account-form').reset(); setSession(data); location.assign('/dashboard.html');
        } catch (error) { $('account-status').textContent = error.message; }
        finally { button.disabled = false; }
    });
});
