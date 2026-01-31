const passwordInput = document.getElementById('master-password');
const loginBtn = document.getElementById('login-btn');
const toggleBtn = document.getElementById('toggle-password');
const errorMsg = document.getElementById('error-msg');

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function clearError() {
    errorMsg.classList.add('hidden');
}

// Check if new user
(async () => {
    try {
        const exists = await window.api.checkDbExists();
        if (!exists) {
            document.querySelector('h2').textContent = "🆕 Welcome";
            document.querySelector('p').textContent = "Set a Master Password to encrypt your vault";
            loginBtn.textContent = "Create Safe Vault";
        }
    } catch (e) {
        console.error(e);
    }
})();

async function attemptLogin() {
    const password = passwordInput.value;
    if (!password) {
        showError('Please enter a password');
        return;
    }

    clearError();
    loginBtn.disabled = true;
    loginBtn.textContent = "Unlocking...";

    try {
        const success = await window.api.login(password);
        if (!success) {
            showError('Incorrect password or database error');
            loginBtn.disabled = false;
            loginBtn.textContent = "Unlock Vault";
        }
        // On success, main process will close this window, so no need to enable button
    } catch (err) {
        showError(err.message || 'Login failed');
        loginBtn.disabled = false;
        loginBtn.textContent = "Unlock Vault";
    }
}

loginBtn.addEventListener('click', attemptLogin);

passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
});

// SVG Icons
const ICON_EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const ICON_EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07-2.3 2.3 13-13 2.3 2.3"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

toggleBtn.innerHTML = ICON_EYE_OPEN;

toggleBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    toggleBtn.innerHTML = type === 'password' ? ICON_EYE_OPEN : ICON_EYE_CLOSED;
    passwordInput.focus();
});
