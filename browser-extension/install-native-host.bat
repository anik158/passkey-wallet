@echo off
REM Multi-Browser Native Host Installer for PassKey Wallet (Windows)

echo ==============================================
echo PassKey Wallet - Native Host Installer
echo ==============================================
echo.

REM Set install directory
set INSTALL_DIR=%LOCALAPPDATA%\PassKey Wallet
set INSTALL_PATH=%INSTALL_DIR%\native-host.exe

REM Create directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy native host (standalone executable, no Node.js needed)
echo Installing native host...
copy "%~dp0dist\native-host-win.exe" "%INSTALL_PATH%" >nul

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to copy native host
    pause
    exit /b 1
)

echo Native host installed to: %INSTALL_PATH%
echo.

REM Browser Selection
echo.
echo Which browser are you installing for?
echo 1) Chromium-based (Chrome, Edge, Brave, etc.)
echo 2) Firefox
set /p BROWSER_SELECT="Select [1-2]: "

if "%BROWSER_SELECT%"=="2" goto firefox_setup

:chromium_setup
echo.
echo --- Chromium Setup ---
set /p EXTENSION_ID="Please enter your extension ID from chrome://extensions: "

if "%EXTENSION_ID%"=="" (
    echo Error: Extension ID required
    pause
    exit /b 1
)

echo.
echo Installing manifests for detected browsers...

REM Chrome
set CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts
if exist "%LOCALAPPDATA%\Google\Chrome" (
    if not exist "%CHROME_DIR%" mkdir "%CHROME_DIR%"
    (
        echo {
        echo   "name": "com.passkey_wallet.native",
        echo   "description": "PassKey Wallet Native Messaging Host",
        echo   "path": "%INSTALL_PATH:\=\%",
        echo   "type": "stdio",
        echo   "allowed_origins": [
        echo     "chrome-extension://%EXTENSION_ID%/"
        echo   ]
        echo }
    ) > "%CHROME_DIR%\com.passkey_wallet.native.json"
    echo   * Chrome
)

REM Edge
set EDGE_DIR=%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts
if exist "%LOCALAPPDATA%\Microsoft\Edge" (
    if not exist "%EDGE_DIR%" mkdir "%EDGE_DIR%"
    (
        echo {
        echo   "name": "com.passkey_wallet.native",
        echo   "description": "PassKey Wallet Native Messaging Host",
        echo   "path": "%INSTALL_PATH:\=\%",
        echo   "type": "stdio",
        echo   "allowed_origins": [
        echo     "chrome-extension://%EXTENSION_ID%/"
        echo   ]
        echo }
    ) > "%EDGE_DIR%\com.passkey_wallet.native.json"
    echo   * Edge
)

REM Brave
set BRAVE_DIR=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\NativeMessagingHosts
if exist "%LOCALAPPDATA%\BraveSoftware" (
    if not exist "%BRAVE_DIR%" mkdir "%BRAVE_DIR%"
    (
        echo {
        echo   "name": "com.passkey_wallet.native",
        echo   "description": "PassKey Wallet Native Messaging Host",
        echo   "path": "%INSTALL_PATH:\=\%",
        echo   "type": "stdio",
        echo   "allowed_origins": [
        echo     "chrome-extension://%EXTENSION_ID%/"
        echo   ]
        echo }
    ) > "%BRAVE_DIR%\com.passkey_wallet.native.json"
    echo   * Brave
)
goto install_complete

:firefox_setup
echo.
echo --- Firefox Setup ---
set FIREFOX_MANIFEST_JSON=%INSTALL_DIR%\com.passkey_wallet.native.json
set FIREFOX_ID=passkey-wallet@passkey-wallet.com

(
    echo {
    echo   "name": "com.passkey_wallet.native",
    echo   "description": "PassKey Wallet Native Messaging Host",
    echo   "path": "%INSTALL_PATH:\=\%",
    echo   "type": "stdio",
    echo   "allowed_extensions": [
    echo     "%FIREFOX_ID%"
    echo   ]
    echo }
) > "%FIREFOX_MANIFEST_JSON%"

echo Created manifest at: %FIREFOX_MANIFEST_JSON%

REM Add Registry Key
echo Adding Registry Key...
reg add "HKCU\Software\Mozilla\NativeMessagingHosts\com.passkey_wallet.native" /ve /t REG_SZ /d "%FIREFOX_MANIFEST_JSON%" /f >nul
echo   * Registry Key Added

echo.
echo Note: For Firefox, you must install the packaged extension (.xpi).
echo Run 'browser-extension\package-firefox.bat' to create it.

:install_complete
echo.
echo Installation complete!
echo.
echo Installation details:
echo   Node.js: %NODE_PATH% (%NODE_VERSION%)
echo   Native host: %INSTALL_PATH%
echo.
echo Next steps:
echo 1. Ensure the extension is installed in your browser
echo 2. Reload the extension
echo.
pause
