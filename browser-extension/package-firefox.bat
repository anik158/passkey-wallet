@echo off
REM Package Firefox extension as .xpi (Windows)

cd /d "%~dp0firefox"

REM Remove old .xpi if exists
if exist "..\passkey-wallet-firefox.xpi" del "..\passkey-wallet-firefox.xpi"

REM Create .xpi using PowerShell (built into Windows)
powershell -Command "Compress-Archive -Path * -DestinationPath ..\passkey-wallet-firefox.zip -Force"
move /y "..\passkey-wallet-firefox.zip" "..\passkey-wallet-firefox.xpi" >nul

echo.
echo * Firefox extension packaged: passkey-wallet-firefox.xpi
echo.
echo Users can install by:
echo   1. Open Firefox
echo   2. Go to about:addons
echo   3. Click gear icon - Install Add-on From File
echo   4. Select passkey-wallet-firefox.xpi
echo.
pause
