@echo off
title MIA - Asistente de Ventas
color 0B

echo ========================================
echo   MIA - Asistente de Ventas
echo   Evaluation Edition
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no encontrado.
    echo.
    echo Descarga Node.js desde: https://nodejs.org
    echo Descarga la version LTS y reinstala este programa.
    echo.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo [INFO] Configurando MIA por primera vez...
    echo.
    if exist ".env.example" (
        copy ".env.example" ".env.local" >nul
        echo Archivo de configuracion creado: .env.local
        echo.
        echo IMPORTANTE: Edita .env.local con tus credenciales:
        echo   - SUPABASE_URL
        echo   - SUPABASE_ANON_KEY
        echo   - SUPABASE_SERVICE_ROLE_KEY
        echo   - OPENAI_API_KEY
        echo.
        start notepad ".env.local"
        pause
    )
)

REM Start MIA
echo Iniciando MIA...
echo.
echo Abre tu navegador en: http://localhost:3000
echo.
echo Presiona Ctrl+C para detener.
echo.

node .next/standalone/server.js

pause
