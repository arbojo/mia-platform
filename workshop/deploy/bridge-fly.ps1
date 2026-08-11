# MIA WhatsApp Bridge — despliegue en Fly.io
# Uso:  ./workshop/deploy/bridge-fly.ps1
# Requiere: flyctl instalado y cuenta Fly.io (login por browser en el primer uso).
# Lee los secretos del .env local (git-crypt) SIN imprimirlos y los sube a Fly.
$ErrorActionPreference = 'Stop'

$appName = 'mia-whatsapp-bridge'
$bridgeDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..\services\whatsapp-bridge')).Path
$envFile = Join-Path $bridgeDir '.env'
$baseUrl = "https://$appName.fly.dev"

if (-not (Get-Command flyctl -ErrorAction SilentlyContinue)) {
  Write-Host '[1/5] flyctl NO instalado. Instálalo primero (confirmar con el equipo):' -ForegroundColor Yellow
  Write-Host '      winget install flyctl'
  Write-Host '      # o:  irm https://fly.io/install.ps1 | iex'
  exit 1
}

Write-Host '[1/5] Verificando sesión de flyctl...' -ForegroundColor Cyan
flyctl auth whoami *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '      Necesitas iniciar sesión en Fly.io (se abrirá el browser).' -ForegroundColor Yellow
  flyctl auth login
}

function Get-EnvVal([string]$name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { throw "Falta $name en $envFile" }
  return ($line -split '=', 2)[1]
}

Write-Host '[2/5] Cargando secretos desde .env local (sin imprimirlos)...' -ForegroundColor Cyan
$supabaseUrl = Get-EnvVal 'NEXT_PUBLIC_SUPABASE_URL'
$serviceRole = Get-EnvVal 'SUPABASE_SERVICE_ROLE_KEY'
$bridgeSecret = Get-EnvVal 'WHATSAPP_BRIDGE_SECRET'
$miaAppUrl = $env:MIA_APP_URL
if (-not $miaAppUrl) { $miaAppUrl = Get-EnvVal 'MIA_APP_URL' }

Write-Host "[3/5] Creando app '$appName' (si no existe)..."
flyctl apps create $appName 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo crear la app '$appName' en Fly.io. Revisa billing o errores arriba."
}

Write-Host '[4/5] Subiendo secretos a Fly...'
$secretArgs = @(
  "NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl",
  "SUPABASE_SERVICE_ROLE_KEY=$serviceRole",
  "WHATSAPP_BRIDGE_SECRET=$bridgeSecret"
)
if ($miaAppUrl) { $secretArgs += "MIA_APP_URL=$miaAppUrl" }
flyctl secrets set -a $appName @secretArgs
if ($LASTEXITCODE -ne 0) { throw 'Fallo al subir secretos' }

Write-Host '[5/5] Desplegando...'
Push-Location $bridgeDir
try {
  flyctl deploy --config fly.toml --app $appName
  if ($LASTEXITCODE -ne 0) { throw 'Fallo el despliegue' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host "Producción lista: $baseUrl" -ForegroundColor Green
Write-Host ''
Write-Host 'Verificación del contrato (esperado 401 sin secreto / JSON con secreto):'
$noSecret = Invoke-WebRequest -Uri "$baseUrl/v1/sessions/test/status" -Method GET -SkipHttpErrorCheck
Write-Host ("  Sin secreto      -> {0} {1}" -f $noSecret.StatusCode, $noSecret.Content)
$withSecret = Invoke-WebRequest -Uri "$baseUrl/v1/sessions/test/status" -Method GET -Headers @{ 'x-mia-bridge-secret' = $bridgeSecret }
Write-Host ("  Con secreto      -> {0} {1}" -f $withSecret.StatusCode, $withSecret.Content)
$health = Invoke-WebRequest -Uri "$baseUrl/healthz" -Method GET
Write-Host ("  /healthz         -> {0} {1}" -f $health.StatusCode, $health.Content)
