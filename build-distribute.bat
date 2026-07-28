@echo off
echo ========================================
echo   MIA Build - Creating Distributable
echo ========================================
echo.

echo [1/4] Building Next.js (standalone mode)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [2/4] Copying static assets...
xcopy /E /I /Y ".next\static" ".next\standalone\.next\static" >nul
xcopy /E /I /Y "public" ".next\standalone\public" >nul

echo.
echo [3/4] Copying configuration files...
copy /Y ".env.example" ".next\standalone\.env.example" >nul
copy /Y "start.bat" ".next\standalone\start.bat" >nul
copy /Y "start.sh" ".next\standalone\start.sh" >nul
copy /Y "README-DISTRIBUTE.md" ".next\standalone\README.md" >nul

echo.
echo [4/4] Creating distributable ZIP...
where powershell >nul 2>nul
if %ERRORLEVEL% equ 0 (
    powershell -Command "Compress-Archive -Path '.next\standalone\*' -DestinationPath 'mia-evaluation.zip' -Force"
    echo.
    echo ========================================
    echo   BUILD COMPLETE
    echo ========================================
    echo.
    echo   Distributable: mia-evaluation.zip
    echo   Size: 
    echo.
    dir /B "mia-evaluation.zip"
) else (
    echo.
    echo   ZIP creation requires PowerShell.
    echo   Distributable folder: .next\standalone\
)

echo.
pause
