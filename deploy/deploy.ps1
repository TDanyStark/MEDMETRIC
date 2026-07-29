param(
    [switch]$Quick,       # Solo codigo del backend (app, public, src, database) — sin vendor, sin tocar frontend salvo que se pida
    [switch]$Full,        # Backend completo + composer install + migraciones/seeds en el servidor (tambien corre --seed, ver advertencia)
    [switch]$FrontOnly,   # Solo build + subida del frontend
    [switch]$BackOnly,    # Solo backend (sin tocar frontend)
    [switch]$Install,     # Solo ejecuta 'composer install --no-dev -o' en el servidor
    [switch]$Migrate,     # Solo ejecuta migraciones en el servidor (toma DB dump antes)
    [switch]$Seed,        # Solo ejecuta migraciones + seeds en el servidor (toma DB dump antes)
    [switch]$Fresh,       # Solo ejecuta migrate --fresh (DROP ALL + migrate + seed) en el servidor — requiere -IAmSure + confirmacion interactiva
    [switch]$IAmSure,     # Flag de doble confirmacion obligatorio para poder usar -Fresh

    # --- Rollback / inspeccion (nuevos) ---
    [switch]$Rollback,        # Restaura el snapshot MAS RECIENTE (codigo, no DB). Pide confirmacion interactiva.
    [string]$RollbackTo,      # Restaura un snapshot especifico por su timestamp UTC (ej. 20260728-143000)
    [switch]$ListReleases,    # Lista snapshots disponibles (solo lectura, seguro)
    [switch]$Status,          # Muestra 'php database/migrate.php --status' remoto (solo lectura, seguro)
    [switch]$DryRun           # Imprime cada comando remoto que se ejecutaria, sin ejecutar nada. No toca produccion.
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

# Directorio de snapshots/backups, FUERA del docroot web (sibling de RemotePath
# por defecto). Configurable via $Config.BackupsRemoteDir / $Config.BackupRetention.
$BackupsRemoteDir = if ($Config.ContainsKey('BackupsRemoteDir') -and $Config.BackupsRemoteDir) {
    $Config.BackupsRemoteDir
} else {
    "$RemotePath/../medmetric_releases"
}
$BackupRetention = if ($Config.ContainsKey('BackupRetention') -and $Config.BackupRetention) {
    [int]$Config.BackupRetention
} else {
    5
}

# Entradas que se excluyen al limpiar/snapshotear la raiz del frontend.
$Excludes = @($Config.KeepEntries) + @("api", ".env_medmetric.bak")
$ExcludeString = ""
foreach ($entry in $Excludes) { $ExcludeString += " ! -name '$entry'" }
$TarExcludeArgsFrontend = ($Excludes | ForEach-Object { "--exclude='$_'" }) -join ' '

# ---------------------------------------------------------------------------
# 3. Helpers SSH/SCP (plink / pscp)
# ---------------------------------------------------------------------------
# NOTA DE SEGURIDAD (conocida, no agravada por este script): $Config.SshPass
# se pasa a plink/pscp via '-pw', lo cual puede ser brevemente visible en la
# lista de procesos local. El helper db-dump-remote.php tiene la misma
# limitacion del lado del servidor con la password de mysqldump. Aceptable
# para este flujo de deploy en shared hosting; no reusar el patron en
# entornos de mayor confianza sin revisarlo.
$SshTarget = "$($Config.SshUser)@$($Config.SshHost)"
$CommonArgs = @("-batch", "-P", "$($Config.SshPort)", "-pw", "$($Config.SshPass)")
if ($Config.SshHostKey) {
    $CommonArgs += "-hostkey"
    $CommonArgs += $Config.SshHostKey
}

function Get-Text {
    param($Value)
    if ($null -eq $Value) { return "" }
    return (($Value | Out-String)).Trim()
}

function Invoke-Ssh {
    param([string]$Command, [string]$WorkDir = $RemotePath)
    $FullCommand = "cd '$WorkDir' && $Command"
    if ($DryRun) {
        Write-Host "  [DRYRUN] ssh> $FullCommand" -ForegroundColor DarkGray
        return ""
    }
    plink @CommonArgs $SshTarget "$FullCommand" 2>&1
}

function Send-SecureFile {
    param($Source, $RemoteRelPath, [int]$Retries = 3)
    $Target = "$($SshTarget):$RemotePath/$RemoteRelPath"
    if ($DryRun) {
        Write-Host "  [DRYRUN] pscp> '$Source' -> $Target" -ForegroundColor DarkGray
        return
    }
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

function Get-UtcTimestamp {
    return (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
}

# ---------------------------------------------------------------------------
# 4. Snapshots / backups (rollback support)
# ---------------------------------------------------------------------------

function New-DbDump {
    <#
        Toma un mysqldump remoto ANTES de correr migraciones. Aborta el
        deploy si el dump falla o queda vacio (salvo en -DryRun).
    #>
    param([string]$SnapshotDir)

    Write-Host "  Generando dump de base de datos (pre-migracion)..." -ForegroundColor Cyan
    Invoke-Ssh "mkdir -p `"$SnapshotDir`""
    Send-SecureFile "$PSScriptRoot\db-dump-remote.php" "_deploy_db_dump.php"
    Invoke-Ssh "mv _deploy_db_dump.php api/_deploy_db_dump.php"
    Invoke-Ssh "php _deploy_db_dump.php `"$SnapshotDir/db.sql`"" -WorkDir $RemoteApiPath | Out-Null
    Invoke-Ssh "rm -f api/_deploy_db_dump.php"

    if (-not $DryRun) {
        $check = Get-Text (Invoke-Ssh "[ -s `"$SnapshotDir/db.sql`" ] && echo DUMP_OK || echo DUMP_EMPTY")
        if ($check -notmatch 'DUMP_OK') {
            Write-Error "El dump de la base de datos fallo o quedo vacio. ABORTANDO antes de ejecutar migraciones. Revisa $SnapshotDir/db.sql.err en el servidor."
            exit 1
        }
        Write-Host "  Dump OK: $SnapshotDir/db.sql" -ForegroundColor Gray
    }
}

function New-FrontendSnapshot {
    <#
        Empaqueta el docroot actual (excluyendo api/ y KeepEntries) ANTES de
        borrarlo. Aborta el deploy si el snapshot falla o queda vacio.
    #>
    param([string]$SnapshotDir)

    Write-Host "  Snapshot de frontend (pre-deploy)..." -ForegroundColor Cyan
    Invoke-Ssh "mkdir -p `"$SnapshotDir`""
    Invoke-Ssh "tar czf `"$SnapshotDir/frontend.tar.gz`" $TarExcludeArgsFrontend -C `"$RemotePath`" ."

    if (-not $DryRun) {
        $check = Get-Text (Invoke-Ssh "[ -s `"$SnapshotDir/frontend.tar.gz`" ] && echo SNAP_OK || echo SNAP_EMPTY")
        if ($check -notmatch 'SNAP_OK') {
            Write-Error "No se pudo crear el snapshot del frontend. ABORTANDO antes de borrar la raiz remota."
            exit 1
        }
        Write-Host "  Snapshot OK: $SnapshotDir/frontend.tar.gz" -ForegroundColor Gray
    }
}

function New-BackendSnapshot {
    <#
        Empaqueta api/ actual (excluyendo vendor/, storage/ y .env) ANTES del
        unzip -o. storage/ se excluye a proposito: puede contener materiales
        subidos por usuarios (PDFs/videos) que NO queremos duplicar en cada
        snapshot de codigo. Aborta el deploy si el snapshot falla o queda vacio.
    #>
    param([string]$SnapshotDir)

    Write-Host "  Snapshot de backend (pre-deploy, excluye vendor/ y storage/)..." -ForegroundColor Cyan
    Invoke-Ssh "mkdir -p `"$SnapshotDir`""
    Invoke-Ssh "tar czf `"$SnapshotDir/backend.tar.gz`" --exclude='vendor' --exclude='storage' --exclude='.env' -C `"$RemoteApiPath`" ."

    if (-not $DryRun) {
        $check = Get-Text (Invoke-Ssh "[ -s `"$SnapshotDir/backend.tar.gz`" ] && echo SNAP_OK || echo SNAP_EMPTY")
        if ($check -notmatch 'SNAP_OK') {
            Write-Error "No se pudo crear el snapshot del backend. ABORTANDO antes de sobreescribir api/."
            exit 1
        }
        Write-Host "  Snapshot OK: $SnapshotDir/backend.tar.gz (vendor/ y storage/ NO incluidos)" -ForegroundColor Gray
    }
}

function Invoke-PruneReleases {
    <#
        Mantiene solo los ultimos $BackupRetention snapshots (por fecha de
        modificacion) y reporta el tamano total del directorio de backups.
    #>
    Write-Host "Aplicando retencion de snapshots (mantener ultimos $BackupRetention)..." -ForegroundColor Cyan
    $PruneScript = @'
mkdir -p "{0}"
cd "{0}"
count=0
for d in $(ls -1dt */ 2>/dev/null); do
  count=$((count+1))
  if [ "$count" -gt {1} ]; then
    rm -rf "$d"
    echo "PRUNED: $d"
  fi
done
echo "BACKUPS_DIR_SIZE: $(du -sh . 2>/dev/null | cut -f1)"
'@ -f $BackupsRemoteDir, $BackupRetention
    $out = Get-Text (Invoke-Ssh $PruneScript)
    if (-not $DryRun -and $out) { Write-Host $out -ForegroundColor Gray }
}

function Show-Releases {
    Write-Host "=== Snapshots disponibles en $BackupsRemoteDir ===" -ForegroundColor Cyan
    $ListScript = @'
mkdir -p "{0}"
cd "{0}"
for d in $(ls -1dt */ 2>/dev/null); do
  name="${{d%/}}"
  size=$(du -sh "$d" 2>/dev/null | cut -f1)
  contents=$(ls "$d" 2>/dev/null | paste -sd, -)
  echo "$name | $size | $contents"
done
echo "TOTAL_SIZE: $(du -sh . 2>/dev/null | cut -f1)"
'@ -f $BackupsRemoteDir
    $out = Get-Text (Invoke-Ssh $ListScript)
    if ($out) { Write-Host $out } else { Write-Host "(sin salida / directorio vacio)" -ForegroundColor Gray }
}

# ---------------------------------------------------------------------------
# 5. Acciones de solo-lectura (seguras, no modifican produccion)
# ---------------------------------------------------------------------------
if ($ListReleases) {
    Show-Releases
    exit
}

if ($Status) {
    Write-Host "=== Estado de migraciones (remoto) ===" -ForegroundColor Cyan
    $out = Get-Text (Invoke-Ssh "php database/migrate.php --status" -WorkDir $RemoteApiPath)
    Write-Host $out
    exit
}

# ---------------------------------------------------------------------------
# 6. Rollback (restaura codigo desde un snapshot; NO restaura la DB)
# ---------------------------------------------------------------------------
if ($Rollback -or $RollbackTo) {
    Write-Host "=== ROLLBACK ===" -ForegroundColor Yellow

    $Target = $RollbackTo
    if (-not $Target) {
        if ($DryRun) {
            Write-Host "  [DRYRUN] se resolveria el snapshot MAS RECIENTE en $BackupsRemoteDir" -ForegroundColor DarkGray
            $Target = "<ultimo-disponible>"
        } else {
            $latest = Get-Text (Invoke-Ssh "ls -1dt `"$BackupsRemoteDir`"/*/ 2>/dev/null | head -n1")
            if (-not $latest) {
                Write-Error "No hay snapshots disponibles en $BackupsRemoteDir para hacer rollback."
                exit 1
            }
            $Target = Split-Path -Leaf ($latest.TrimEnd('/'))
        }
    }

    $TargetDir = "$BackupsRemoteDir/$Target"

    if (-not $DryRun) {
        $listing = Get-Text (Invoke-Ssh "ls -1 `"$TargetDir`" 2>/dev/null")
        if (-not $listing -or $listing -match 'No such file') {
            Write-Error "El snapshot '$Target' no existe en $BackupsRemoteDir."
            exit 1
        }
        $hasFrontend = $listing -match 'frontend\.tar\.gz'
        $hasBackend  = $listing -match 'backend\.tar\.gz'
        $hasDb       = $listing -match 'db\.sql'
    } else {
        $hasFrontend = $true; $hasBackend = $true; $hasDb = $true
    }

    Write-Host "Restaurando snapshot: $Target (UTC)" -ForegroundColor Yellow
    Write-Host "Contenido detectado -> frontend: $hasFrontend | backend: $hasBackend | db dump: $hasDb" -ForegroundColor Yellow

    if (-not $DryRun -and -not ($hasFrontend -or $hasBackend)) {
        Write-Error "El snapshot '$Target' no contiene ni frontend.tar.gz ni backend.tar.gz. Nada que restaurar."
        exit 1
    }

    if (-not $DryRun) {
        $confirm = Read-Host "Escribe 'ROLLBACK' para confirmar la restauracion de codigo desde '$Target'"
        if ($confirm -ne 'ROLLBACK') {
            Write-Host "Cancelado. No se restauro nada." -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Host "  [DRYRUN] se pediria confirmacion interactiva ('ROLLBACK') antes de restaurar" -ForegroundColor DarkGray
    }

    if ($hasFrontend) {
        Write-Host "Restaurando frontend..." -ForegroundColor Cyan
        Invoke-Ssh "find . -maxdepth 1 $ExcludeString ! -name '.' ! -name '..' -exec rm -rf {} +"
        Invoke-Ssh "tar xzf `"$TargetDir/frontend.tar.gz`" -C `"$RemotePath`""
        Write-Host "  Frontend restaurado desde $Target." -ForegroundColor Green
    }
    if ($hasBackend) {
        Write-Host "Restaurando backend (api/, sin vendor/ ni storage/ ni .env)..." -ForegroundColor Cyan
        Invoke-Ssh "tar xzf `"$TargetDir/backend.tar.gz`" -C `"$RemoteApiPath`""
        Write-Host "  Backend restaurado desde $Target. Si el snapshot es de otra version de composer.json/lock, corre '-Install' aparte." -ForegroundColor Green
    }

    Write-Host "" 
    Write-Host "=== IMPORTANTE: la base de datos NO se restauro automaticamente ===" -ForegroundColor Red
    if ($hasDb) {
        Write-Host "Hay un dump disponible para este snapshot en: $TargetDir/db.sql" -ForegroundColor Yellow
        Write-Host "'database/migrate.php' NO tiene migraciones 'down'; restaurar ese dump" -ForegroundColor Yellow
        Write-Host "sobreescribe TODAS las tablas actuales y es una decision MANUAL y DESTRUCTIVA." -ForegroundColor Yellow
        Write-Host "Si decides restaurarlo, hazlo tu mismo por SSH, por ejemplo:" -ForegroundColor Yellow
        Write-Host "  mysql -h DB_HOST -u DB_USER -p DB_NAME < '$TargetDir/db.sql'" -ForegroundColor Yellow
    } else {
        Write-Host "Este snapshot no incluye dump de base de datos (no se corrieron migraciones en ese deploy)." -ForegroundColor Yellow
    }
    exit
}

# ---------------------------------------------------------------------------
# 7. Acciones aisladas (DB / composer) — no despliegan codigo
# ---------------------------------------------------------------------------
if ($Install) {
    Write-Host "Ejecutando composer install en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "composer install --no-dev --optimize-autoloader" -WorkDir $RemoteApiPath | Write-Host
    exit
}
if ($Migrate) {
    $SnapshotDir = "$BackupsRemoteDir/$(Get-UtcTimestamp)"
    New-DbDump -SnapshotDir $SnapshotDir
    Write-Host "Ejecutando migraciones en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php" -WorkDir $RemoteApiPath | Write-Host
    Invoke-PruneReleases
    exit
}
if ($Seed) {
    $SnapshotDir = "$BackupsRemoteDir/$(Get-UtcTimestamp)"
    New-DbDump -SnapshotDir $SnapshotDir
    Write-Host "Ejecutando migraciones + seeds en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php --seed" -WorkDir $RemoteApiPath | Write-Host
    Invoke-PruneReleases
    exit
}
if ($Fresh) {
    if (-not $IAmSure) {
        Write-Error "-Fresh requiere tambien el flag -IAmSure (doble confirmacion). Ejemplo: .\deploy.ps1 -Fresh -IAmSure"
        exit 1
    }

    Write-Host ""
    Write-Host "!!! PELIGRO: -Fresh va a hacer DROP de TODAS las tablas en produccion !!!" -ForegroundColor Red
    Write-Host "No existe undo automatico de base de datos, solo el dump que se toma antes." -ForegroundColor Red

    if (-not $DryRun) {
        $dbName = Get-Text (Invoke-Ssh "grep -m1 '^DB_NAME=' `"$RemoteApiPath/.env`" 2>/dev/null | cut -d= -f2-")
        $prompt = if ($dbName) { "Escribe el nombre de la base de datos ('$dbName') o 'FRESH' para confirmar" } else { "Escribe 'FRESH' para confirmar" }
        $typed = Read-Host $prompt
        if ($typed -ne 'FRESH' -and (-not $dbName -or $typed -ne $dbName)) {
            Write-Host "Cancelado. No se ejecuto -Fresh." -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Host "  [DRYRUN] se pediria confirmacion interactiva (nombre de BD o 'FRESH') antes de continuar" -ForegroundColor DarkGray
    }

    $SnapshotDir = "$BackupsRemoteDir/$(Get-UtcTimestamp)"
    New-DbDump -SnapshotDir $SnapshotDir

    Write-Host "FRESH: DROP ALL + migrate + seed en el servidor..." -ForegroundColor Yellow
    Invoke-Ssh "php database/migrate.php --fresh" -WorkDir $RemoteApiPath | Write-Host
    Invoke-PruneReleases
    exit
}

Write-Host "=== Despliegue MEDMETRIC ===" -ForegroundColor Cyan
if ($Full) {
    Write-Host "ADVERTENCIA: -Full tambien ejecuta 'migrate.php --seed' automaticamente al final del despliegue." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 8. Preparar carpeta temporal
# ---------------------------------------------------------------------------
$TempPath = "$PSScriptRoot\temp_deploy"
if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }
New-Item -ItemType Directory -Path $TempPath | Out-Null

$DoFrontend = -not $BackOnly
$DoBackend  = -not $FrontOnly

# ---------------------------------------------------------------------------
# 9. Build + empaquetado Frontend
# ---------------------------------------------------------------------------
$FrontendZip = $null
if ($DoFrontend) {
    if ($DryRun) {
        Write-Host "[DRYRUN] build del frontend (npm run build) + empaquetado - omitido localmente" -ForegroundColor DarkGray
        $FrontendZip = "$TempPath\frontend.zip"
    } else {
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
}

# ---------------------------------------------------------------------------
# 10. Empaquetado Backend
# ---------------------------------------------------------------------------
$ApiZip = $null
if ($DoBackend) {
    if ($DryRun) {
        Write-Host "[DRYRUN] empaquetado del backend (Quick/Full/Estandar) - omitido localmente" -ForegroundColor DarkGray
        $ApiZip = "$TempPath\api.zip"
    } else {
        $ApiTemp = "$TempPath\api_build"
        New-Item -ItemType Directory -Path "$ApiTemp\api" | Out-Null

        if ($Quick) {
            Write-Host "Backend (Quick): solo app, public, src, database, bin..." -ForegroundColor Gray
            foreach ($folder in @("app", "public", "src", "database", "bin")) {
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
}

# ---------------------------------------------------------------------------
# 11. Respaldar .env del servidor
# ---------------------------------------------------------------------------
if ($DoBackend) {
    Write-Host "Respaldando api/.env del servidor..." -ForegroundColor Cyan
    Invoke-Ssh "mkdir -p api && ([ -f api/.env ] && cp api/.env ../.env_medmetric.bak && echo 'env respaldado') || echo 'sin .env previo'"
}

# ---------------------------------------------------------------------------
# 12. Snapshot pre-deploy (frontend y/o backend) — mismo timestamp para ambos
# ---------------------------------------------------------------------------
$SnapshotDir = $null
if ($DoFrontend -or $DoBackend) {
    $SnapshotDir = "$BackupsRemoteDir/$(Get-UtcTimestamp)"
    Invoke-Ssh "mkdir -p `"$SnapshotDir`""
}

# ---------------------------------------------------------------------------
# 13. Subir y desplegar
# ---------------------------------------------------------------------------
if ($DoFrontend -and $FrontendZip) {
    Write-Host "Subiendo frontend..." -ForegroundColor Cyan

    New-FrontendSnapshot -SnapshotDir $SnapshotDir

    # Limpiar raiz manteniendo api/ y excepciones, luego descomprimir
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

    New-BackendSnapshot -SnapshotDir $SnapshotDir

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
# 14. Composer + DB (solo en Full)
# ---------------------------------------------------------------------------
if ($Full -and $DoBackend) {
    Write-Host "Composer install en el servidor..." -ForegroundColor Cyan
    Invoke-Ssh "composer install --no-dev --optimize-autoloader" -WorkDir $RemoteApiPath | Write-Host

    New-DbDump -SnapshotDir $SnapshotDir

    Write-Host "Ejecutando migraciones + seeds..." -ForegroundColor Cyan
    Invoke-Ssh "php database/migrate.php --seed" -WorkDir $RemoteApiPath | Write-Host
}

# ---------------------------------------------------------------------------
# 15. Retencion de snapshots + limpieza local
# ---------------------------------------------------------------------------
if ($SnapshotDir) {
    Invoke-PruneReleases
}

if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }

$Elapsed = (Get-Date) - $DeployStart
Write-Host "Despliegue completado." -ForegroundColor Green
Write-Host "Tiempo total: $([math]::Floor($Elapsed.TotalMinutes))m $($Elapsed.Seconds)s" -ForegroundColor Cyan
