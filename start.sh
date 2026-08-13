#!/bin/bash

echo "========================================"
echo "  MIA - Asistente de Ventas"
echo "  Evaluation Edition"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no encontrado."
    echo ""
    echo "Instala Node.js desde: https://nodejs.org"
    echo "Descarga la version LTS."
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "[INFO] Configurando MIA por primera vez..."
    echo ""
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env.local"
        echo "Archivo de configuracion creado: .env.local"
        echo ""
        echo "IMPORTANTE: Edita .env.local con tus credenciales:"
        echo "  - SUPABASE_URL"
        echo "  - SUPABASE_ANON_KEY"
        echo "  - SUPABASE_SERVICE_ROLE_KEY"
        echo "  - OPENAI_API_KEY"
        echo ""
        echo "Usa: nano .env.local"
        read -p "Presiona Enter cuando hayas terminado de configurar..."
    fi
fi

# Preparar el standalone (assets estaticos y public)
echo "Preparando servidor standalone..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

# Start MIA
echo "Iniciando MIA..."
echo ""
echo "Abre tu navegador en: http://localhost:3000"
echo ""
echo "Presiona Ctrl+C para detener."
echo ""

node --env-file=.env.local .next/standalone/server.js
