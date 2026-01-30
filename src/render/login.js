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

toggleBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
});
