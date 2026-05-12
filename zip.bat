@echo off
setlocal enabledelayedexpansion

set "SOURCE_DIR=%~dp0"
set "SOURCE_DIR=%SOURCE_DIR:~0,-1%"
for %%I in ("%SOURCE_DIR%") do set "ZIP_NAME=%%~nxI"
set "ZIP_FILE=%SOURCE_DIR%\%ZIP_NAME%.zip"
set "TEMP_DIR=%TEMP%\%ZIP_NAME%_Temp_%RANDOM%"

echo Creating temporary copy...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%"

robocopy "%SOURCE_DIR%" "%TEMP_DIR%" /E /XD node_modules .git dist build .next out .cache /XF package-lock.json yarn.lock pnpm-lock.yaml bun.lock .env zip.bat *.zip /R:0 /W:0

echo.
echo Creating zip archive...
pwsh -NoProfile -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ZIP_FILE%' -CompressionLevel Optimal -Force"

if %ERRORLEVEL% NEQ 0 (
  powershell -NoProfile -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ZIP_FILE%' -CompressionLevel Optimal -Force"
)

rmdir /s /q "%TEMP_DIR%"

if exist "%ZIP_FILE%" (
    for %%a in ("%ZIP_FILE%") do echo Done  %ZIP_NAME%.zip  %%~za bytes
) else (
    echo Failed to create zip
)

exit /b 0