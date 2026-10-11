# Isolated, local development demo. Never writes backend/.env or touches PostgreSQL.
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectDir 'backend'
$FrontendDir = Join-Path $ProjectDir 'frontend'
$PythonExe = Join-Path $BackendDir '.venv\Scripts\python.exe'
$DemoDir = Join-Path $ProjectDir '.demo'
$DemoDb = Join-Path $DemoDir 'demo-repuestos.sqlite3'
if (!(Test-Path $PythonExe)) { throw 'Primero ejecuta scripts\setup.ps1 para preparar el entorno.' }
$OldDatabase = $env:DATABASE_URL
$OldUploads = $env:UPLOADS_DIR
$OldEnvironment = $env:APP_ENV
$OldCookie = $env:COOKIE_SECURE
$OldDemo = $env:DEMO_MODE
try {
    New-Item -ItemType Directory -Force -Path $DemoDir | Out-Null
    $env:DATABASE_URL = 'sqlite:///' + ($DemoDb -replace '\\','/')
    $env:UPLOADS_DIR = Join-Path $DemoDir 'imagenes'
    $env:APP_ENV = 'development'
    $env:COOKIE_SECURE = 'false'
    $env:DEMO_MODE = 'true'
    Push-Location $BackendDir
    try {
        & $PythonExe -m pip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
        & $PythonExe -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base de demostración.' }
        $DemoState = & $PythonExe -c "from sqlalchemy import select; from sqlalchemy.orm import Session; from app.db.session import engine; from app.models import User; s=Session(engine); exists=s.scalar(select(User.id).limit(1)) is not None; s.close(); print('existing' if exists else 'new')"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar la base.' }
        if ($DemoState -eq 'new') {
            & $PythonExe -m app.cli demo-repuestos
            if ($LASTEXITCODE -ne 0) { throw 'No se pudieron crear los datos ficticios.' }
        } elseif ($DemoState -ne 'existing') { throw 'Estado inesperado de la demostración.' }
        if (!(Test-Path (Join-Path $FrontendDir 'dist\index.html'))) {
            Push-Location $FrontendDir
            try {
                & npm ci
                if ($LASTEXITCODE -ne 0) { throw 'npm ci falló.' }
                & npm run build
                if ($LASTEXITCODE -ne 0) { throw 'La compilación de React falló.' }
            } finally { Pop-Location }
        }
        Write-Host 'Demo Repuestos: http://localhost:8000' -ForegroundColor Yellow
        Write-Host 'Propietario: propietario@demo-repuestos.example.com. Usa la contraseña elegida al crear la demo.'
        Write-Host 'Base ficticia separada en .demo. Para detener: Ctrl+C.'
        & $PythonExe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
    } finally { Pop-Location }
} finally {
    $env:DATABASE_URL = $OldDatabase
    $env:UPLOADS_DIR = $OldUploads
    $env:APP_ENV = $OldEnvironment
    $env:COOKIE_SECURE = $OldCookie
    $env:DEMO_MODE = $OldDemo
}
