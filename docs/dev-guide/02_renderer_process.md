# PassKey Wallet - Developer Guide (Part 2: The Renderer Process - Frontend/UI)

Welcome to Part 2! In the previous guide, we looked at the Main Process (Node.js backend). Now, we'll look at the **Renderer Process**, which is responsible for the actual User Interface you see and interact with.

Because Electron uses Chromium (the engine behind Google Chrome) to display the UI, the Renderer process is built exactly like a modern web application: using HTML, CSS, JavaScript, and a bundler called **Vite**.

Let's break down the core frontend files and how they work.

---

## 1. `vite.config.ts` (The Bundler Configuration)

Vite is a modern, blazing-fast frontend build tool. In this project, it's configured specifically for Electron using a plugin. 

### Key Responsibilities:
- Compiling modern JavaScript/TypeScript into browser-compatible code.
- Defining the multiple "entry points" for our application (since we have multiple windows, we have multiple HTML files).
- Building the bridging script (`preload.js`).

### Objectives of the configuration:
* **`plugins: [electron({...})]`**: This tells Vite how to build the Main Process code alongside the Renderer code. It ensures that files like `src/main/index.js` and `src/preload.js` are properly compiled into the `dist-electron/` folder.
* **`build: { rollupOptions: { input: {...} } }`**: Unlike a standard Single Page Application (SPA) that only has one `index.html`, this app uses multiple HTML files for different windows. We explicitly tell Vite to build:
  * `dashboard.html`
  * `overlay.html`
  * `login.html`
  * `browser-setup.html`

---

## 2. `src/preload.js` (The Security Bridge)

By default, for security reasons, Electron's Renderer process (the web browser part) is **not allowed** to use Node.js modules like `fs` (file system) or `child_process`. It can only use standard web APIs.

However, our UI *needs* to trigger database lookups, encrypt data, and read files. To do this safely, we use a Preload script.

### Objective:
The preload script runs *before* the web page loads, safely exposing a heavily restricted API (using `contextBridge.exposeInMainWorld`) to the web page.

### How it works:
It exposes a global object called `window.api`. 
Instead of the UI saying, "Node, save this password to SQLite," the UI calls `window.api.addCredential(data)`. The preload script then uses `ipcRenderer.invoke` to send a secure message to the Main Process (`index.js`).

---

## 3. The HTML Entry Points (`src/render/*.html`)

We use multiple HTML files, one for each specific window in the app. Each HTML file loads its own dedicated CSS and JavaScript.

### `login.html` & `assets/login.js`
* **Objective**: Handles the initial user authentication.
* **How it works**: 
  1. The user types their Master Password.
  2. The JS script calls `window.api.login(password)`.
  3. The Main Process tries to decrypt the DB with it. If successful, the Main process closes the login window and unhides the Dashboard.

### `dashboard.html` & `assets/dashboard.js`
* **Objective**: The primary control center where users view, add, edit, and delete their passwords, and manage app settings.
* **How it works**:
  * **Loading data**: On load, it calls `window.api.getCredentials()` to fetch all passwords and populates the table using standard DOM manipulation (`document.createElement`).
  * **Adding passwords**: The user clicks "Add Password", a modal opens, they type the details, and clicking "Save" calls `window.api.addCredential(...)`.
  * **Pagination & Search**: The JS file contains logic to filter the credentials array based on the search bar input and handles splitting the results across multiple pages.

### `overlay.html` & `assets/overlay.js`
* **Objective**: The transparent, floating window that appears when `Ctrl+Alt+P` is pressed, allowing users to copy passwords directly into their browser.
* **How it works**:
  * It has special CSS (`background: transparent`) and the Main process creates the window as frameless, so it looks like a floating widget.
  * Instead of requesting data, it *listens* for data. The `preload.js` exposes a way to listen for `show-credentials`. When the Main process detects a URL, it pushes the data to the overlay. The JS renders the buttons and handles copying to the clipboard.

### `browser-setup.html` & `extension-prompt.html`
* **Objective**: Dedicated standalone wizards that guide the user through installing the browser extension and native messaging host.
* **How it works**: They contain step-by-step UI logic (hiding/showing different `div`s) and use `window.api.runNativeHostInstaller()` to trigger background scripts on the user's OS.

---

### Understanding the Flow (Example: Adding a password)
To pull Part 1 and Part 2 together, here is the exact life cycle of how a user adds a password:

1. **Frontend (dashboard.html/js)**: User clicks "Save". The JS calls `await window.api.addCredential({ domain, username, password })`.
2. **Bridge (preload.js)**: Receives the call, packages it into a message, and fires `ipcRenderer.invoke('add-credential', data)`.
3. **Backend (index.js)**: `ipcMain.handle('add-credential')` hears the message. It extracts the data.
4. **Database (db.js & crypto.js)**: `index.js` calls `db.addCredential()`. `crypto.js` generates a random IV, encrypts the password with AES-256-GCM, and `db.js` runs the `INSERT INTO credentials` SQL command.
5. **Return**: The DB confirms success. `index.js` replies back through the IPC channel to the UI, and the UI reloads the table to show the new password.

---

### What's Next?
In Part 3, we can cover the **Browser Extension**, or the **Native Messaging Host Installers**. Let me know!
