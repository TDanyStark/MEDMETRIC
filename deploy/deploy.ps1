param(
    [switch]$Quick,       # Solo codigo del backend (app, public, src, database) — sin vendor, sin tocar frontend salvo que se pida
    [switch]$Full,        # Backend completo + composer install + migraciones/seeds en el servidor
    [switch]$FrontOnly,   # Solo build + subida del frontend
    [switch]$BackOnly,    # Solo backend (sin tocar frontend)
    [switch]$Install,     # Solo ejecuta 'composer install --no-dev -o' en el servidor
    [switch]$Migrate,     # Solo ejecuta migraciones en el servidor
    [switch]$Seed,        # Solo ejecuta migraciones + seeds en el servidor
    [switch]$Fresh        # Solo ejecuta migrate --fresh (DROP ALL + migrate + seed) en el servidor
)

$ErrorActionPreference = "Stop"
$DeployStart = Get-Date

# ---------------------------------------------------------------------------
# 1. Cargar configuracion
# ---------------------------------------------------------------------------
$ConfigPath = "$PSScriptRoot\deploy.config.ps1"
if (-not (Test-Path $ConfigPath)) {
    Write-Error "No se encontro 'deploy.config.ps1' en $PSScriptRoot. Crealo con las credenciales."
    exit 1
}
. $ConfigPath

# ---------------------------------------------------------------------------
# 2. Rutas
# ---------------------------------------------------------------------------
$ProjectRoot   = Split-Path $PSScriptRoot -Parent   # .../MEDMETRIC
$FrontendDir   = "$ProjectRoot\frontend"
$BackendDir    = "$ProjectRoot\backend"
$HtaccessDir   = "$PSScriptRoot\hostinger"

$RemotePath    = $Config.RemotePath
$RemoteApiPath = "$RemotePath/api"

# ---------------------------------------------------------------------------
# 3. Helpers SSH/SCP (plink / pscp)
# ---------------------------------------------------------------------------
$SshTarget = "$($Config.SshUser)@$($Config.SshHost)"
$CommonArgs = @("-batch", "-P", "$($Config.SshPort)", "-pw", "$($Config.SshPass)")
if ($Config.SshHostKey) {
    $CommonArgs += "-hostkey"
    $CommonArgs += $Config.SshHostKey
}

function Invoke-Ssh {
    param([string]$Command, [string]$WorkDir = $RemotePath)
    $FullCommand = "cd '$WorkDir' && $Command"
    plink @CommonArgs $SshTarget "$FullCommand" 2>&1
}

function Send-SecureFile {
    param($Source, $RemoteRelPath, [int]$Retries = 3)
    $Target = "$($SshTarget):$RemotePath/$RemoteRelPath"
    $PscpArgs = @()
    foreach ($arg in $CommonArgs) { $PscpArgs += $arg }
    $PscpArgs += $Source
    $PscpArgs += $Target

    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        pscp @PscpArgs
        if ($LASTEXITCODE -eq 0) { return }
        Write-Host "  Subida fallo (intento $attempt/$Retries). Reintentando en 3s..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
    Write-Error "No se pudo subir '$RemoteRelPath' tras $Retries intentos."
    exit 1
}

# ---------------------------------------------------------------------------
# 4. Acciones aisladas (DB / composer) — no despliegan codigo
# ---------------------------------------------------------------------------
if ($Install) {
    Write-Host "Ejecutando composer install en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "composer install --no-dev --optimize-autoloader" -WorkDir $RemoteApiPath
    exit
}
if ($Migrate) {
    Write-Host "Ejecutando migraciones en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php" -WorkDir $RemoteApiPath
    exit
}
if ($Seed) {
    Write-Host "Ejecutando migraciones + seeds en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php --seed" -WorkDir $RemoteApiPath
    exit
}
if ($Fresh) {
    Write-Host "FRESH: DROP ALL + migrate + seed en el servidor..." -ForegroundColor Yellow
    Invoke-Ssh "php database/migrate.php --fresh" -WorkDir $RemoteApiPath
    exit
}

Write-Host "=== Despliegue MEDMETRIC ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 5. Preparar carpeta temporal
# ---------------------------------------------------------------------------
$TempPath = "$PSScriptRoot\temp_deploy"
if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }
New-Item -ItemType Directory -Path $TempPath | Out-Null

$DoFrontend = -not $BackOnly
$DoBackend  = -not $FrontOnly

# ---------------------------------------------------------------------------
# 6. Build + empaquetado Frontend
# ---------------------------------------------------------------------------
$FrontendZip = $null
if ($DoFrontend) {
    Write-Host "Build del frontend (vite)..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    try { npm run build } catch { Pop-Location; Write-Error "Build del frontend fallo"; exit 1 }
    Pop-Location

    if (-not (Test-Path "$FrontendDir\dist\index.html")) {
        Write-Error "No se genero frontend\dist\index.html"; exit 1
    }

    $FrontendZip = "$TempPath\frontend.zip"
    Compress-Archive -Path "$FrontendDir\dist\*" -DestinationPath $FrontendZip
    Write-Host "  frontend.zip listo." -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# 7. Empaquetado Backend
# ---------------------------------------------------------------------------
$ApiZip = $null
if ($DoBackend) {
    $ApiTemp = "$TempPath\api_build"
    New-Item -ItemType Directory -Path "$ApiTemp\api" | Out-Null

    if ($Quick) {
        Write-Host "Backend (Quick): solo app, public, src, database..." -ForegroundColor Gray
        foreach ($folder in @("app", "public", "src", "database")) {
            if (Test-Path "$BackendDir\$folder") {
                Copy-Item -Path "$BackendDir\$folder" -Destination "$ApiTemp\api\$folder" -Recurse
            }
        }
    } elseif ($Full) {
        Write-Host "Backend (Full): todo el codigo (vendor se instala en servidor)..." -ForegroundColor Yellow
        Copy-Item -Path "$BackendDir\*" -Destination "$ApiTemp\api" -Recurse `
            -Exclude @("vendor", ".env", ".git", "logs", "var", "tests", "node_modules", "*.cache")
    } else {
        Write-Host "Backend (Estandar): codigo + composer.json/lock (sin vendor)..." -ForegroundColor Gray
        Copy-Item -Path "$BackendDir\*" -Destination "$ApiTemp\api" -Recurse `
            -Exclude @("vendor", ".env", ".git", "logs", "var", "tests", "node_modules", "*.cache")
    }

    # Nunca subir .env: el del servidor manda
    Get-ChildItem -Path "$ApiTemp\api" -Filter ".env" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    $ApiZip = "$TempPath\api.zip"
    Compress-Archive -Path "$ApiTemp\*" -DestinationPath $ApiZip
    Write-Host "  api.zip listo." -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# 8. Respaldar .env del servidor
# ---------------------------------------------------------------------------
if ($DoBackend) {
    Write-Host "Respaldando api/.env del servidor..." -ForegroundColor Cyan
    Invoke-Ssh "mkdir -p api && ([ -f api/.env ] && cp api/.env ../.env_medmetric.bak && echo 'env respaldado') || echo 'sin .env previo'"
}

# ---------------------------------------------------------------------------
# 9. Subir y desplegar
# ---------------------------------------------------------------------------
if ($DoFrontend -and $FrontendZip) {
    Write-Host "Subiendo frontend..." -ForegroundColor Cyan
    # Limpiar raiz manteniendo api/ y excepciones, luego descomprimir
    $Excludes = $Config.KeepEntries + "api" + ".env_medmetric.bak"
    $ExcludeString = ""
    foreach ($entry in $Excludes) { $ExcludeString += " ! -name '$entry'" }
    Invoke-Ssh "find . -maxdepth 1 $ExcludeString ! -name '.' ! -name '..' -exec rm -rf {} +"

    Send-SecureFile $FrontendZip "frontend.zip"
    Invoke-Ssh "unzip -o frontend.zip && rm frontend.zip"

    if (Test-Path "$HtaccessDir\root.htaccess") {
        Write-Host "Subiendo .htaccess raiz (SPA)..." -ForegroundColor Cyan
        Send-SecureFile "$HtaccessDir\root.htaccess" ".htaccess"
    }
}

if ($DoBackend -and $ApiZip) {
    Write-Host "Subiendo backend..." -ForegroundColor Cyan
    Send-SecureFile $ApiZip "api.zip"
    Invoke-Ssh "unzip -o api.zip && rm api.zip"

    # El api.htaccess (routing a index.php) va DENTRO de api/public/.
    # El api/.htaccess (redireccion raiz -> public/) ya viene en el zip desde backend/.htaccess.
    if (Test-Path "$HtaccessDir\api.htaccess") {
        Write-Host "Subiendo api/public/.htaccess..." -ForegroundColor Cyan
        Send-SecureFile "$HtaccessDir\api.htaccess" "api/public/.htaccess"
    }

    # Restaurar .env
    Write-Host "Restaurando api/.env..." -ForegroundColor Cyan
    Invoke-Ssh "([ -f ../.env_medmetric.bak ] && mv ../.env_medmetric.bak api/.env && echo 'env restaurado') || echo 'sin backup que restaurar'"
}

# ---------------------------------------------------------------------------
# 10. Composer + DB (solo en Full)
# ---------------------------------------------------------------------------
if ($Full -and $DoBackend) {
    Write-Host "Composer install en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "composer install --no-dev --optimize-autoloader" -WorkDir $RemoteApiPath

    Write-Host "Ejecutando migraciones + seeds..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php --seed" -WorkDir $RemoteApiPath
}

# ---------------------------------------------------------------------------
# 11. Limpieza local
# ---------------------------------------------------------------------------
if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }

$Elapsed = (Get-Date) - $DeployStart
Write-Host "Despliegue completado." -ForegroundColor Green
Write-Host "Tiempo total: $([math]::Floor($Elapsed.TotalMinutes))m $($Elapsed.Seconds)s" -ForegroundColor Cyan
