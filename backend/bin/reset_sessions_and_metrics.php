<?php

declare(strict_types=1);

/**
 * MEDMETRIC - Reset Visit Sessions & Metrics (maintenance script)
 *
 * Deletes ALL visit sessions and their associated metrics/views, across
 * ALL organizations, to "start from zero" in production. Does NOT touch
 * catalog/identity data (materials, doctors, users, organizations, brands,
 * manager_brands, rep_manager_access, roles, material_studies).
 *
 * By default runs in DRY RUN mode (only counts rows, deletes nothing).
 * Pass --confirm to actually execute the deletes.
 *
 * Usage:
 *   php bin/reset_sessions_and_metrics.php            # Dry run (counts only)
 *   php bin/reset_sessions_and_metrics.php --confirm  # Executes the real delete
 */

use App\Infrastructure\Database\Connection;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// ---------------------------------------------------------------------------
// Config: tables to wipe, in strict child -> parent order.
// ---------------------------------------------------------------------------

const TABLES_TO_RESET = [
    'material_views',
    'study_views',
    'visit_session_materials',
    'visit_sessions',
];

// Tables that must NEVER be touched by this script. Kept here only as a
// documented safeguard/reference for reviewers — no query in this file
// references any of them.
const PROTECTED_TABLES = [
    'materials',
    'material_studies',
    'doctors',
    'users',
    'organizations',
    'brands',
    'manager_brands',
    'rep_manager_access',
    'roles',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countRows(PDO $pdo, string $table): int
{
    $stmt = $pdo->query("SELECT COUNT(*) AS `cnt` FROM `{$table}`");
    return (int) $stmt->fetch()['cnt'];
}

function printCounts(PDO $pdo, array $tables, string $heading): void
{
    echo $heading . PHP_EOL;
    foreach ($tables as $table) {
        $count = countRows($pdo, $table);
        printf("  %-28s %d row(s)%s", $table, $count, PHP_EOL);
    }
    echo PHP_EOL;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

try {
    $pdo = Connection::getConnection();
} catch (PDOException $e) {
    fwrite(STDERR, "[ERROR] Cannot connect to database: " . $e->getMessage() . PHP_EOL);
    exit(1);
}

$args    = array_slice($argv, 1);
$confirm = in_array('--confirm', $args, true);

echo "=== MEDMETRIC - Reset Visit Sessions & Metrics ===" . PHP_EOL . PHP_EOL;

// ---------------------------------------------------------------------------
// Dry run (default): just show current counts, delete nothing.
// ---------------------------------------------------------------------------

if (!$confirm) {
    printCounts($pdo, TABLES_TO_RESET, "Current row counts (nothing will be deleted):");
    echo "DRY RUN — no se borro nada. Corre con --confirm para ejecutar el borrado real." . PHP_EOL;
    exit(0);
}

// ---------------------------------------------------------------------------
// --confirm: show BEFORE counts, delete inside a transaction, show results.
// ---------------------------------------------------------------------------

printCounts($pdo, TABLES_TO_RESET, "Row counts BEFORE delete:");

$deleted = [];

try {
    $pdo->beginTransaction();

    foreach (TABLES_TO_RESET as $table) {
        $rowCount = $pdo->exec("DELETE FROM `{$table}`");
        $deleted[$table] = (int) $rowCount;
    }

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "[ERROR] Delete failed, transaction rolled back: " . $e->getMessage() . PHP_EOL);
    exit(1);
}

echo "Rows deleted:" . PHP_EOL;
foreach ($deleted as $table => $rowCount) {
    printf("  %-28s %d row(s) deleted%s", $table, $rowCount, PHP_EOL);
}
echo PHP_EOL;

printCounts($pdo, TABLES_TO_RESET, "Row counts AFTER delete:");

echo "OK — sesiones de visita y metricas asociadas fueron eliminadas correctamente en todas las organizaciones." . PHP_EOL;
exit(0);
