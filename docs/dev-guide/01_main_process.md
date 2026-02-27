# PassKey Wallet - Developer Guide (Part 1: The Main Process)

This guide explains the architecture of PassKey Wallet and how the application works under the hood. 

In Electron, there are two distinct environments that work together:
1. **The Main Process (Node.js)**: This is the invisible backend. It has full access to the operating system, file system, databases, and native APIs. 
2. **The Renderer Process (Chromium)**: This is the front-end UI you actually see (HTML/CSS/JS).

In this first part, we will cover the core files of the **Main Process**, located in `src/main/`.

---

## 1. `src/main/index.js` (The Application Entry Point)

This is the most important file in the application. When you run the app, Node.js executes this file first. It acts as the orchestrator for the entire application.

### Key Responsibilities:
- Managing the lifecycle of the app (startup, background running, quitting).
- Creating and managing all the different windows (Login, Dashboard, Overlay).
- Setting up the System Tray icon and Global Keyboard Shortcuts.
- Acting as a bridge (via IPC) between the UI and the database/OS.

### Core Methods & Their Objectives:

* **`createLoginWindow()`**
  * **Objective**: Creates the initial authentication window. It uses a frameless `BrowserWindow`, loads `login.html`, and waits for the user to enter the master password.
* **`createDashboardWindow()`**
  * **Objective**: Creates the main UI window where users manage their passwords. It initially creates it but keeps it hidden (`show: false`) until the user successfully logs in.
* **`createOverlayWindow()`**
  * **Objective**: Creates the invisible, transparent, always-on-top window used for the `Ctrl+Alt+P` quick-fill feature. It's pre-loaded so it can appear instantly when the hotkey is pressed.
* **`createTray()`**
  * **Objective**: Creates the system tray icon (the little key icon near your clock). It sets up a context menu allowing the user to restore the dashboard or quit the app entirely.
* **`startApp()`**
  * **Objective**: Called immediately after a successful login. It creates the overlay and dashboard, starts the auto-lock security timer, and registers the `Ctrl+Alt+P` global shortcut.
* **`startAutoLockTimer()` / `resetAutoLockTimer()` / `lockApp()`**
  * **Objective**: Security feature. It tracks user activity. If the user is idle for a specified number of minutes (default 5), `lockApp()` is called. This destroys the dashboard, closes the database, and forces the login screen to reappear.
* **`globalShortcut.register('Control+Alt+P', ...)`**
  * **Objective**: Listens for the keyboard shortcut anywhere in the OS. When pressed, it checks if the app is currently unlocked. If yes, it attempts to detect the active browser URL, fetches matching credentials from the DB, and shows the overlay.
* **`ipcMain.handle(...)` & `ipcMain.on(...)` blocks**
  * **Objective**: These are event listeners. Since the UI (Renderer) cannot talk to the Database directly for security reasons, it sends messages via IPC (Inter-Process Communication). `index.js` listens to these messages (like `login`, `get-credentials`, `add-credential`), performs the secure Node.js work, and returns the result.

---

## 2. `src/main/db.js` (Database Management)

This app uses SQLite, a lightweight database that stores everything in a single local file (`passwords.db`). To make it secure, we use a special version called `better-sqlite3-multiple-ciphers` which encrypts the entire database file automatically using SQLCipher.

### Core Methods & Their Objectives:

* **`initializeDatabase(masterPassword)`**
  * **Objective**: Opens the connection to `passwords.db` using the provided master password as the decryption key. If the file doesn't exist, it creates it. It runs the initial `PRAGMA` commands to unlock it and creates the `credentials` table if this is the first run.
* **`closeDatabase()`**
  * **Objective**: Safely closes the database connection. This is critical for security; when the app locks, closing the DB ensures that no memory dumps or malicious scripts can read the data.
* **`addCredential(domain, username, password)`**
  * **Objective**: Inserts a new row into the `credentials` table. (Note: the `password` passed here is heavily encrypted *before* it gets saved to the DB).
* **`getCredentials(domain)`**
  * **Objective**: Searches the database for any saved logins that match the requested domain (e.g., `github.com`).
* **`getAllCredentials()`**
  * **Objective**: Retrieves all rows from the database. Used to populate the Dashboard list.
* **`updateCredential(id, newPassword)` / `deleteCredential(id)`**
  * **Objective**: Standard SQL `UPDATE` and `DELETE` operations using the unique row `id`.

---

## 3. `src/main/crypto.js` (Encryption & Security)

This file handles the heavy cryptographic math. While SQLCipher encrypts the database *file*, we add a second layer of security by encrypting the actual password text *before* saving it. We also stretch the master password using Argon2id (a state-of-the-art hashing algorithm).

### Core Methods & Their Objectives:

* **`deriveKey(masterPassword, salt)`**
  * **Objective**: You never use a raw password directly for encryption. This method uses Argon2id to computationally "stretch" the user's master password along with a random "salt" to generate a highly secure, 32-byte (256-bit) cryptographic key. 
* **`encryptText(text, key)`**
  * **Objective**: Takes a plain text password (e.g., "mySecret123") and encrypts it using the AES-256-GCM cipher. It generates a random Initialization Vector (IV), encrypts the text, and attaches an authentication tag (to prevent tampering). It returns all these pieces combined as a single string.
* **`decryptText(encryptedData, key)`**
  * **Objective**: Reverses `encryptText`. It takes the combined string, splits it back into the IV, auth tag, and encrypted text, and uses the AES-256-GCM decipher to mathematically restore the original plain text password.
* **`exportPasswords(key)` / `importPasswords(filePath, key)`**
  * **Objective**: Handles securely exporting your vault to a customized `.qpass` binary file, and parsing that custom binary format back into the database.

---

*(See Part 2 for documentation on the Renderer Process).*
