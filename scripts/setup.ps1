$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location "$root\backend"
if (-not (Test-Path '.venv\Scripts\python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno Python.' }
}
if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Se creó backend/.env. Completa DB_PASSWORD y vuelve a ejecutar setup.ps1.'
    exit 0
}
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación de dependencias.' }
& '.\.venv\Scripts\python.exe' -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar las migraciones. Revisa .env y PostgreSQL.' }
Set-Location "$root\frontend"
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del frontend.' }
Set-Location $root
Write-Host 'Instalación actualizada. Si aún no hay propietario, ejecuta python -m app.cli init-owner desde backend con su entorno virtual.'
