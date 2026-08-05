<?php

/**
 * MEDMETRIC - Diagnostico y normalizacion de `doctors.region`
 *
 * Contexto (sdd/doctors-management-fixes): las importaciones masivas del
 * Kardex escriben el string de `Región` tal cual viene del Excel (con o sin
 * tildes, códigos romanos, abreviaturas, "RM", etc.), mientras que el
 * filtro de /doctors compara contra los 16 nombres canonicos de
 * CHILE_REGIONS. Esta herramienta es SOLO para datos YA existentes en la
 * base (las escrituras nuevas ya se normalizan en el import y en
 * Create/UpdateDoctorAction via RegionCatalog::normalizeRegion()).
 *
 * *** ESTA HERRAMIENTA NUNCA ESCRIBE POR DEFECTO ***
 *
 * Modos (mutuamente excluyentes, en orden de progresion obligatoria):
 *   1) Diagnostico (DEFAULT, sin flags): reporta `region, COUNT(*)` por
 *      organizacion. CERO escritura, no requiere --org.
 *   2) --dry-run: para cada valor de region distinto, muestra el mapeo
 *      canonico propuesto (o "SIN MAPEO" si es irreconocible) y cuantas
 *      filas afectaria. CERO escritura.
 *   3) --apply: escribe SOLO las filas cuyo valor tiene un mapeo canonico
 *      confirmado. Las filas sin mapeo NUNCA se tocan — quedan listadas al
 *      final para revision manual. Requiere --org=<id> explicito (no se
 *      permite aplicar a todas las organizaciones de una sola corrida).
 *
 * PRERREQUISITOS ANTES DE USAR --apply (OBLIGATORIO):
 *   a) Backup completo de la base de datos (mysqldump o snapshot del
 *      hosting). Sin esto, NO ejecutar --apply bajo ninguna circunstancia.
 *   b) Correr el modo diagnostico (1) para la organizacion.
 *   c) Correr --dry-run y revisar CADA fila propuesta + la lista de
 *      "SIN MAPEO" con quien conozca los datos de esa organizacion
 *      (stakeholder / equipo de datos).
 *   d) Solo entonces, con el visto bueno, correr --apply.
 *   e) Re-correr el modo diagnostico despues de --apply para confirmar
 *      que los valores mapeados colapsaron a los nombres canonicos.
 *
 * Uso:
 *   php database/normalize_doctor_regions.php                        # diagnostico, todas las orgs
 *   php database/normalize_doctor_regions.php --org=3                # diagnostico, una org
 *   php database/normalize_doctor_regions.php --org=3 --dry-run       # simulacion, sin escribir
 *   php database/normalize_doctor_regions.php --org=3 --apply         # APLICA (requiere backup previo)
 *
 * Este script es intencionalmente NO invocado por ningun otro proceso
 * automatizado (CI, deploy, cron) — es una herramienta manual, un-off,
 * ejecutada a mano por un operador humano que ya siguio los prerrequisitos.
 */

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Infrastructure\Region\RegionCatalog;
use Dotenv\Dotenv;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function getArg(array $argv, string $name, ?string $default = null): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, "--{$name}=")) {
            return substr($arg, strlen("--{$name}="));
        }
    }
    return $default;
}

function hasFlag(array $argv, string $name): bool
{
    return in_array("--{$name}", $argv, true);
}

$args = array_slice($argv, 1);

$orgIdArg = getArg($args, 'org');
$dryRun   = hasFlag($args, 'dry-run');
$apply    = hasFlag($args, 'apply');

if ($dryRun && $apply) {
    fwrite(STDERR, "[ERROR] --dry-run y --apply son mutuamente excluyentes. Usa uno a la vez." . PHP_EOL);
    exit(1);
}

if ($apply && $orgIdArg === null) {
    fwrite(STDERR, "[ERROR] --apply requiere --org=<id> explicito. No se permite aplicar a todas las organizaciones en una sola corrida." . PHP_EOL);
    exit(1);
}

$organizationId = $orgIdArg !== null ? (int) $orgIdArg : null;
if ($orgIdArg !== null && $organizationId <= 0) {
    fwrite(STDERR, "[ERROR] --org debe ser un entero positivo." . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Bootstrap DB (misma logica que database/migrate.php / import_doctors.php)
// ---------------------------------------------------------------------------

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$host    = $_ENV['DB_HOST']    ?? '127.0.0.1';
$port    = $_ENV['DB_PORT']    ?? '3306';
$dbName  = $_ENV['DB_NAME']    ?? 'medmetric';
$user    = $_ENV['DB_USER']    ?? 'root';
$pass    = $_ENV['DB_PASS']    ?? '';
$charset = $_ENV['DB_CHARSET'] ?? 'utf8mb4';

$dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "[ERROR] No se pudo conectar a la base de datos: " . $e->getMessage() . PHP_EOL);
    exit(1);
}

if ($apply) {
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" . PHP_EOL;
    echo "!! MODO --apply: esto ESCRIBIRA en la tabla `doctors` de organization_id={$organizationId}." . PHP_EOL;
    echo "!! Confirma que ya hiciste: (a) backup de la BD, (b) diagnostico, (c) --dry-run" . PHP_EOL;
    echo "!! revisado con el stakeholder de la organizacion. Ctrl+C ahora si no es asi." . PHP_EOL;
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" . PHP_EOL;
    echo PHP_EOL . "Continuando en 5 segundos... (Ctrl+C para cancelar)" . PHP_EOL;
    sleep(5);
}

// ---------------------------------------------------------------------------
// Modo 1: Diagnostico — SELECT region, COUNT(*) por organizacion. Solo lectura.
// ---------------------------------------------------------------------------

function runDiagnostic(PDO $pdo, ?int $organizationId): void
{
    echo "=== Diagnostico de `doctors.region`" . ($organizationId !== null ? " (organization_id={$organizationId})" : " (TODAS las organizaciones)") . " ===" . PHP_EOL;
    echo "(Solo lectura — no se modifica ningun dato.)" . PHP_EOL . PHP_EOL;

    $where  = 'WHERE region IS NOT NULL AND region != \'\'';
    $params = [];
    if ($organizationId !== null) {
        $where .= ' AND organization_id = :org';
        $params[':org'] = $organizationId;
    }

    // Grouped in PHP (not SQL GROUP BY) deliberately: MySQL's default
    // collation on this column is accent-INSENSITIVE (utf8mb4_*_ai_ci), so
    // `GROUP BY region` silently merges e.g. "Valparaiso" and "Valparaíso"
    // into one bucket, hiding exactly the kind of raw-string variance this
    // report exists to surface. Fetching raw rows and grouping by the exact
    // PHP string (byte-for-byte via ===) avoids that collation trap.
    $stmt = $pdo->prepare("SELECT organization_id, region FROM doctors {$where} ORDER BY organization_id ASC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($rows)) {
        echo "(Sin filas con `region` no vacio.)" . PHP_EOL;
        return;
    }

    // orgId => [rawRegion => count]
    $counts = [];
    foreach ($rows as $row) {
        $orgId = (int) $row['organization_id'];
        $counts[$orgId][$row['region']] = ($counts[$orgId][$row['region']] ?? 0) + 1;
    }

    $canonicalCount = 0;
    $nonCanonicalCount = 0;
    $unmappableCount = 0;

    foreach ($counts as $orgId => $regionCounts) {
        echo PHP_EOL . "-- organization_id={$orgId} --" . PHP_EOL;
        arsort($regionCounts);

        foreach ($regionCounts as $raw => $cnt) {
            $canonical = RegionCatalog::normalizeRegion($raw);
            $isCanonical = $canonical === $raw;

            if ($canonical === null) {
                $status = 'SIN MAPEO';
                $unmappableCount++;
            } elseif ($isCanonical) {
                $status = 'ya canonico';
                $canonicalCount++;
            } else {
                $status = "-> \"{$canonical}\"";
                $nonCanonicalCount++;
            }

            printf("  %6d  %-40s  [%s]" . PHP_EOL, $cnt, $raw, $status);
        }
    }

    echo PHP_EOL . "Resumen: {$canonicalCount} valores ya canonicos, {$nonCanonicalCount} normalizables, {$unmappableCount} SIN MAPEO (requieren revision manual)." . PHP_EOL;
}

// ---------------------------------------------------------------------------
// Modo 2/3: dry-run / apply — agrupa por valor de region distinto dentro
// de la organizacion, calcula el mapeo, y (solo en --apply) escribe las
// filas con mapeo confirmado.
// ---------------------------------------------------------------------------

function runNormalization(PDO $pdo, int $organizationId, bool $apply): void
{
    $mode = $apply ? 'APLICANDO CAMBIOS' : 'DRY RUN (sin escritura)';
    echo "=== Normalizacion de `doctors.region` — {$mode} — organization_id={$organizationId} ===" . PHP_EOL . PHP_EOL;

    // Grouped in PHP for the same reason as runDiagnostic(): the column's
    // default collation is accent-insensitive, so a SQL GROUP BY would
    // silently merge distinct raw spellings.
    $stmt = $pdo->prepare(
        'SELECT region
         FROM doctors
         WHERE organization_id = :org AND region IS NOT NULL AND region != \'\''
    );
    $stmt->execute([':org' => $organizationId]);
    $rawRegions = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($rawRegions)) {
        echo "(Sin filas con `region` no vacio para esta organizacion.)" . PHP_EOL;
        return;
    }

    $regionCounts = array_count_values($rawRegions);
    arsort($regionCounts);

    $toApply = []; // raw => [canonical, count]
    $unmappable = []; // raw => count
    $alreadyCanonical = []; // raw => count

    foreach ($regionCounts as $raw => $cnt) {
        $canonical = RegionCatalog::normalizeRegion($raw);

        if ($canonical === null) {
            $unmappable[$raw] = $cnt;
            echo "  [SIN MAPEO]     \"{$raw}\" ({$cnt} filas) — se EXCLUYE, requiere revision manual." . PHP_EOL;
        } elseif ($canonical === $raw) {
            $alreadyCanonical[$raw] = $cnt;
            echo "  [ya canonico]   \"{$raw}\" ({$cnt} filas) — sin cambio." . PHP_EOL;
        } else {
            $toApply[$raw] = [$canonical, $cnt];
            echo "  [normalizable]  \"{$raw}\" -> \"{$canonical}\" ({$cnt} filas)" . PHP_EOL;
        }
    }

    echo PHP_EOL;

    if (!$apply) {
        echo "[DRY RUN] No se escribio nada. " . count($toApply) . " valor(es) se normalizarian, "
            . count($unmappable) . " valor(es) SIN MAPEO quedarian excluidos, "
            . count($alreadyCanonical) . " ya canonico(s)." . PHP_EOL;
        echo "Revisa la lista de SIN MAPEO con el stakeholder de la organizacion antes de correr --apply." . PHP_EOL;
        return;
    }

    // --apply: solo escribe los valores con mapeo confirmado (self::$toApply).
    // Las filas SIN MAPEO nunca se tocan. `BINARY region = :raw` fuerza
    // comparacion exacta byte-a-byte (la coleccion por defecto de la
    // columna es accent-insensitive, así que un `region = :raw` sin BINARY
    // podria tambien tocar una fila con una grafia distinta pero
    // collation-equivalente a $raw).
    $updateStmt = $pdo->prepare(
        'UPDATE doctors SET region = :canonical WHERE organization_id = :org AND BINARY region = :raw'
    );

    $totalUpdated = 0;
    $pdo->beginTransaction();
    try {
        foreach ($toApply as $raw => [$canonical, $cnt]) {
            $updateStmt->execute([':canonical' => $canonical, ':org' => $organizationId, ':raw' => $raw]);
            $totalUpdated += $updateStmt->rowCount();
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, "[ERROR] Fallo la actualizacion, se revirtio todo: " . $e->getMessage() . PHP_EOL);
        exit(1);
    }

    echo "[APPLY] {$totalUpdated} fila(s) actualizada(s) a su region canonica." . PHP_EOL;

    if (!empty($unmappable)) {
        echo PHP_EOL . "-- Valores SIN MAPEO excluidos de esta corrida (revisar manualmente) --" . PHP_EOL;
        foreach ($unmappable as $raw => $cnt) {
            echo "  \"{$raw}\" ({$cnt} filas)" . PHP_EOL;
        }
    }

    echo PHP_EOL . "Recomendado: vuelve a correr el modo diagnostico (sin --dry-run/--apply) para confirmar que los valores mapeados colapsaron a los nombres canonicos." . PHP_EOL;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

if ($apply) {
    runNormalization($pdo, (int) $organizationId, true);
} elseif ($dryRun) {
    if ($organizationId === null) {
        fwrite(STDERR, "[ERROR] --dry-run requiere --org=<id>." . PHP_EOL);
        exit(1);
    }
    runNormalization($pdo, $organizationId, false);
} else {
    runDiagnostic($pdo, $organizationId);
}
