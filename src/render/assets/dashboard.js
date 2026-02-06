console.log('Dashboard script loaded!');

// Custom Alert/Confirm Dialog System
function customAlert(message, title = 'Notice') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogTitle = document.getElementById('dialogTitle');
        const dialogMessage = document.getElementById('dialogMessage');
        const dialogCancel = document.getElementById('dialogCancel');
        const dialogConfirm = document.getElementById('dialogConfirm');

        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogCancel.style.display = 'none';
        dialogConfirm.textContent = 'OK';

        dialog.classList.add('active');
        dialogConfirm.focus();

        const close = () => {
            dialog.classList.remove('active');
            resolve();
        };

        dialogConfirm.onclick = close;
    });
}

function customConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogTitle = document.getElementById('dialogTitle');
        const dialogMessage = document.getElementById('dialogMessage');
        const dialogCancel = document.getElementById('dialogCancel');
        const dialogConfirm = document.getElementById('dialogConfirm');

        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogCancel.style.display = 'inline-block';
        dialogConfirm.textContent = 'Confirm';

        dialog.classList.add('active');
        dialogConfirm.focus();

        const close = (result) => {
            dialog.classList.remove('active');
            resolve(result);
        };

        dialogCancel.onclick = () => close(false);
        dialogConfirm.onclick = () => close(true);
    });
}

const tableBody = document.querySelector('tbody');
const modal = document.getElementById('modal');
const form = document.getElementById('credForm');

// Pager Elements
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageInfo = document.getElementById('pageInfo');

// State
let isEditing = false;
let currentPage = 1;
const PAGE_SIZE = 10;
let totalItems = 0;

// Initialize
async function loadCredentials() {
    try {
        // Fetch valid page
        const { data, total } = await window.api.getCredentialsPage(currentPage, PAGE_SIZE);
        totalItems = total;

        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #666;">No passwords saved yet.</td></tr>';
            updatePagination();
            return;
        }

        data.forEach(cred => {
            const tr = document.createElement('tr');

            // Basic escaping for attributes is sufficient
            // (Note: Can still be XSS risky in worst-case; templating libraries are preferred)
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };

            tr.innerHTML = `
                <td>${escapeHtml(cred.domain)}</td>
                <td>${escapeHtml(cred.username)}</td>
                <td class="masked-pass" title="Hover to reveal">••••••••</td>
                <td class="action-cell">
                    <button class="btn-copy btn-sm" data-pass="${escapeHtml(cred.password)}">Copy</button>
                    <button class="btn-edit btn-sm" data-id="${cred.id}" data-domain="${escapeHtml(cred.domain)}" data-user="${escapeHtml(cred.username)}" data-pass="${escapeHtml(cred.password)}">Edit</button>
                    <button class="btn-delete btn-sm btn-danger" data-id="${cred.id}">Delete</button>
                </td>`;

            // Setup listeners for this row
            const copyBtn = tr.querySelector('.btn-copy');
            copyBtn.onclick = () => window.api.copyToClipboard(copyBtn.dataset.pass);

            const editBtn = tr.querySelector('.btn-edit');

            editBtn.onclick = () => {
                isEditing = true;
                document.getElementById('modalTitle').textContent = 'Edit Credential';
                document.getElementById('editId').value = editBtn.dataset.id;
                document.getElementById('inpDomain').value = editBtn.dataset.domain;
                // Domain is now editable - no longer disabled
                document.getElementById('inpUsername').value = editBtn.dataset.user;
                document.getElementById('inpPassword').value = editBtn.dataset.pass;
                modal.classList.add('active');
                document.getElementById('inpDomain').focus();
            };

            const delBtn = tr.querySelector('.btn-delete');
            delBtn.onclick = async () => {
                if (await customConfirm(`Delete password for ${cred.domain}?`, 'Delete Credential')) {
                    await window.api.deleteCredential(cred.id);
                    loadCredentials();
                }
            };

            tableBody.appendChild(tr);
        });

        updatePagination();
    } catch (err) {
        console.error('Failed to load credentials:', err);
    }
}

function updatePagination() {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= totalPages;
}

btnPrev.onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        loadCredentials();
    }
};

btnNext.onclick = () => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (currentPage < totalPages) {
        currentPage++;
        loadCredentials();
    }
};

function renderTable(creds) {
    tableBody.innerHTML = '';

    if (creds.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #666;">No passwords found.</td></tr>';
        return;
    }

    creds.forEach(cred => {
        const tr = document.createElement('tr');

        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        tr.innerHTML = `
                <td>${escapeHtml(cred.domain)}</td>
                <td>${escapeHtml(cred.username)}</td>
                <td class="masked-pass" title="Hover to reveal">••••••••</td>
                <td class="action-cell">
                    <button class="btn-copy btn-sm" data-id="${cred.id}">Copy</button>
                    <button class="btn-edit btn-sm" data-id="${cred.id}">Edit</button>
                    <button class="btn-delete btn-sm btn-danger" data-id="${cred.id}">Delete</button>
                </td>`;

        // Setup listeners using closure data (safer than data attributes)
        const copyBtn = tr.querySelector('.btn-copy');
        copyBtn.onclick = () => window.api.copyToClipboard(cred.password);

        const editBtn = tr.querySelector('.btn-edit');
        editBtn.onclick = () => {
            isEditing = true;
            document.getElementById('modalTitle').textContent = 'Edit Credential';
            document.getElementById('editId').value = cred.id;
            document.getElementById('inpDomain').value = cred.domain;
            document.getElementById('inpUser').value = cred.username;
            document.getElementById('inpPass').value = cred.password;
            modal.classList.add('active');
            document.getElementById('inpDomain').focus();
        };

        const delBtn = tr.querySelector('.btn-delete');
        delBtn.onclick = async () => {
            if (await customConfirm(`Delete password for ${cred.domain}?`, 'Delete Credential')) {
                await window.api.deleteCredential(cred.id);
                loadCredentials();
            }
        };

        tableBody.appendChild(tr);
    });
}

// Event Listeners
// Check if element exists before attaching to avoid errors if ID changed
const btnRefresh = document.getElementById('btnRefresh');
if (btnRefresh) btnRefresh.onclick = loadCredentials;

document.getElementById('btnAdd').onclick = () => {
    console.log('Add clicked');


    isEditing = false;
    document.getElementById('modalTitle').textContent = 'Add Credential';
    document.getElementById('inpDomain').value = '';
    document.getElementById('inpUser').value = '';
    document.getElementById('inpPass').value = '';
    modal.classList.add('active');
    document.getElementById('inpDomain').focus();
};

document.getElementById('btnCancel').onclick = () => {
    modal.classList.remove('active');
};

form.onsubmit = async (e) => {
    e.preventDefault();
    const domain = document.getElementById('inpDomain').value.trim();
    const username = document.getElementById('inpUser').value.trim();
    const password = document.getElementById('inpPass').value;

    if (!domain || !username || !password) return;

    if (isEditing) {
        // If you're editing, get the ID
        const id = document.getElementById('editId').value;
        // Before saving, we need to check:
        // The user might have changed the domain/username in the edit form
        // If they did, we must check for duplicates
        // findCredential returns null or the found credential

        // Check if domain+username combo already exists
        const existing = await window.api.findCredential(domain, username);
        if (existing && (!isEditing || existing.id !== parseInt(id))) {
            const overwrite = await customConfirm(`A password for ${domain} (${username}) already exists. Do you want to overwrite it?\n\nThe existing password will be updated.`, 'Duplicate Credential');
            if (!overwrite) {
                modal.classList.remove('active');
                return;
            }
            await window.api.updateCredential(existing.id, username, password);
            await customAlert('Password updated!', 'Success');
        } else if (isEditing) {
            await window.api.updateCredential(id, username, password);
            await customAlert('Password updated successfully!', 'Success');
        } else {
            const data = { domain, username, password };
            await window.api.addCredential(data);
            await customAlert('Password added successfully!', 'Success');
        }
    } else {
        const data = { domain, username, password };
        await window.api.addCredential(data);
        await customAlert('Password added successfully!', 'Success');
    }

    console.log('Saved');

    modal.classList.remove('active');
    loadCredentials();
};

document.getElementById('btnImport').onclick = async () => {
    // Using logic from main, which returns detailed stats
    const res = await window.api.importFromExcel();

    if (res.requiresConfirmation) {
        // Construct detailed duplicate message
        const { duplicates, validRows } = res;
        let msg = `Found ${duplicates.total} duplicate(s):\n`;

        if (duplicates.file.length > 0) {
            msg += `\n${duplicates.file.length} duplicate(s) within Excel file (skipped):\n${duplicates.file.slice(0, 5).join(', ')}${duplicates.file.length > 5 ? '...' : ''}`;
        }
        if (duplicates.db.length > 0) {
            msg += `\n\n${duplicates.db.length} already exist in database (will update):\n${duplicates.db.slice(0, 5).join(', ')}${duplicates.db.length > 5 ? '...' : ''}`;
        }
        msg += `\n\nContinue importing ${validRows.length} unique entries?`;

        // Show custom dialog instead of system dialog
        if (await customConfirm(msg, 'Duplicate Warning')) {
            const forceRes = await window.api.forceImportFromExcel(validRows);
            if (forceRes.success) {
                await customAlert(`Imported ${forceRes.count} passwords successfully!`, 'Success');
                currentPage = 1;
                loadCredentials();
            } else {
                await customAlert('Import failed: ' + forceRes.message, 'Import Error');
            }
        }
    } else if (res.success) {
        let msg = `Imported ${res.count} passwords!`;
        if (res.skipped > 0) msg += ` (Skipped ${res.skipped} invalid rows)`;
        await customAlert(msg, 'Success');
        currentPage = 1; // Go to first page to see new items
        loadCredentials();
    } else if (!res.cancelled) {
        await customAlert('Import failed: ' + res.message, 'Import Error');
    }
};

// Export button removed

// Password Prompt Helper
function requestPassword(title, promptText) {
    return new Promise((resolve) => {
        const passModal = document.getElementById('passModal');
        const passForm = document.getElementById('passForm');
        const passInput = document.getElementById('backupPassword');
        const promptLabel = document.getElementById('passModalDesc');
        const passTitle = document.getElementById('passModalTitle');

        passTitle.textContent = title;
        promptLabel.textContent = promptText;
        passInput.value = '';
        passModal.classList.add('active');

        const close = (val) => {
            passModal.classList.remove('active');
            resolve(val);
            // Cleanup listeners to avoid dupes if reused? 
            // Simpler: Just override onclicks every time since we return a new promise
        };

        document.getElementById('btnPassCancel').onclick = () => close(null);

        passForm.onsubmit = (e) => {
            e.preventDefault();
            close(passInput.value);
        };
    });
}

document.getElementById('btnBackup').onclick = async () => {
    const password = await requestPassword('Backup Password', 'Set a password to encrypt this backup file:');
    if (!password) return;

    const res = await window.api.exportEncrypted(password);
    if (res.success) await customAlert('Backup saved successfully!', 'Backup Complete');
    else await customAlert('Backup failed: ' + res.message, 'Backup Error');
};

document.getElementById('btnRestore').onclick = async () => {
    const filePath = await window.api.selectBackupFile();
    if (!filePath || filePath.canceled) return;

    const password = await requestPassword('Restore Password', 'Enter the password used to encrypt this backup:');
    if (!password) return;

    // Restore restores from the given file + password
    const res = await window.api.restoreBackup(filePath, password);
    if (res.success) {
        await customAlert(`Restored ${res.count} passwords!`, 'Restore Complete');
        loadCredentials();
    } else {
        await customAlert('Restore failed: ' + res.message, 'Restore Error');
    }
};

// Password Toggle Logic
// Password Toggle Logic (Fixed)
// SVG Icons (Matching Login Window)
const ICON_EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const ICON_EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07-2.3 2.3 13-13 2.3 2.3"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.innerHTML = ICON_EYE_OPEN; // Initial icon
    btn.onclick = () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        btn.innerHTML = type === 'password' ? ICON_EYE_OPEN : ICON_EYE_CLOSED;
    };
});

// Lock button
document.getElementById('btnLock').onclick = () => {
    window.api.lockApp();
};

// Settings
const settingsModal = document.getElementById('settingsModal');
const inpAutoLock = document.getElementById('inpAutoLock');

document.getElementById('btnSettings').onclick = async () => {
    try {
        const settings = await window.api.getSettings();
        inpAutoLock.value = settings.autoLockMinutes || 60;
        settingsModal.classList.add('active');
    } catch (err) {
        console.error(err);
        await customAlert('Error loading settings: ' + err.message, 'Settings Error');
    }
};

document.getElementById('btnSettingsCancel').onclick = () => {
    settingsModal.classList.remove('active');
};

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    await window.api.saveSettings({
        autoLockMinutes: inpAutoLock.value
    });
    await customAlert('Settings saved!', 'Success');
    settingsModal.classList.remove('active');
};

// Delete all
document.getElementById('btnDeleteAll').onclick = async () => {
    if (await customConfirm('Are you SURE you want to delete ALL passwords? This action cannot be undone!', 'Confirm Delete All')) {
        // Double-confirm because it's destructive
        if (await customConfirm('This will permanently delete everything from your vault. Final confirmation?', 'Final Confirmation')) {
            const result = await window.api.deleteAllCredentials();
            if (result.success) {
                await customAlert('All credentials have been deleted.', 'Success');
                loadCredentials();
            } else {
                await customAlert('Failed to delete credentials: ' + result.message, 'Error');
            }
        }
    }
};

// Help Modal Logic
const btnHelp = document.getElementById('btnHelp');
const helpModal = document.getElementById('helpModal');
const btnHelpClose = document.getElementById('btnHelpClose');

if (btnHelp) {
    btnHelp.onclick = () => {
        helpModal.classList.add('active');
    }
}
if (btnHelpClose) {
    btnHelpClose.onclick = () => {
        helpModal.classList.remove('active');
    }
}

// Hamburger menu toggle logic (responsive)
const btnBurger = document.getElementById('btnBurger');
const mainActions = document.getElementById('mainActions');
if (btnBurger && mainActions) {
    btnBurger.onclick = () => {
        mainActions.classList.toggle('show');
    };
    mainActions.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            mainActions.classList.remove('show');
        });
    });
}

// Search Functionality
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

if (searchInput) {
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (searchTerm) {
            clearSearch.style.display = 'block';
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const domain = row.cells[0]?.textContent.toLowerCase() || '';
                const username = row.cells[1]?.textContent.toLowerCase() || '';
                if (domain.includes(searchTerm) || username.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        } else {
            clearSearch.style.display = 'none';
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => row.style.display = '');
        }
    });
}

if (clearSearch) {
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => row.style.display = '');
    });
}

// Start
loadCredentials();