<?php

/**
 * MEDMETRIC - Database Migration & Seed Runner
 *
 * Usage:
 *   php database/migrate.php              # Run pending migrations
 *   php database/migrate.php --seed       # Run pending migrations + seeds
 *   php database/migrate.php --seed-only  # Run pending seeds only
 *   php database/migrate.php --fresh      # Drop all tables and re-run everything
 *   php database/migrate.php --status     # Show migration status
 */

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// ---------------------------------------------------------------------------
// Bootstrap
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
    die("[ERROR] Cannot connect to database: " . $e->getMessage() . PHP_EOL);
}

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

$args      = array_slice($argv, 1);
$runSeed   = in_array('--seed', $args, true);
$seedOnly  = in_array('--seed-only', $args, true);
$fresh     = in_array('--fresh', $args, true);
$status    = in_array('--status', $args, true);

// ---------------------------------------------------------------------------
// Ensure migrations_log table exists
// ---------------------------------------------------------------------------

$pdo->exec("
    CREATE TABLE IF NOT EXISTS `migrations_log` (
        `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `filename`   VARCHAR(255) NOT NULL,
        `type`       ENUM('migration','seed') NOT NULL,
        `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_migrations_log_filename` (`filename`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getApplied(PDO $pdo, string $type): array
{
    $stmt = $pdo->prepare("SELECT `filename` FROM `migrations_log` WHERE `type` = ?");
    $stmt->execute([$type]);
    return array_column($stmt->fetchAll(), 'filename');
}

function markApplied(PDO $pdo, string $filename, string $type): void
{
    $stmt = $pdo->prepare("INSERT IGNORE INTO `migrations_log` (`filename`, `type`) VALUES (?, ?)");
    $stmt->execute([$filename, $type]);
}

function getSqlFiles(string $dir): array
{
    if (!is_dir($dir)) {
        return [];
    }
    $files = glob($dir . DIRECTORY_SEPARATOR . '*.sql');
    sort($files);
    return $files ?: [];
}

function runSqlFile(PDO $pdo, string $filepath): void
{
    $sql = file_get_contents($filepath);
    
    // Remove comments to avoid issues with semicolons inside them
    $sql = preg_replace('/--.*$/m', '', $sql);
    $sql = preg_replace('/\/\*.*?\*\//s', '', $sql);

    // Split on statement delimiter, skip empty statements
    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        fn($s) => $s !== ''
    );
    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }
}

function colorLine(string $color, string $text): string
{
    $colors = ['green' => "\033[32m", 'yellow' => "\033[33m", 'red' => "\033[31m", 'reset' => "\033[0m"];
    return ($colors[$color] ?? '') . $text . $colors['reset'];
}

// ---------------------------------------------------------------------------
// --status
// ---------------------------------------------------------------------------

if ($status) {
    $migrationsDir = __DIR__ . '/migrations';
    $seedsDir      = __DIR__ . '/seeds';

    $appliedMigrations = getApplied($pdo, 'migration');
    $appliedSeeds      = getApplied($pdo, 'seed');

    echo PHP_EOL . "=== Migrations ===" . PHP_EOL;
    foreach (getSqlFiles($migrationsDir) as $file) {
        $name    = basename($file);
        $applied = in_array($name, $appliedMigrations, true);
        echo ($applied ? colorLine('green', "[x] ") : colorLine('yellow', "[ ] ")) . $name . PHP_EOL;
    }

    echo PHP_EOL . "=== Seeds ===" . PHP_EOL;
    foreach (getSqlFiles($seedsDir) as $file) {
        $name    = basename($file);
        $applied = in_array($name, $appliedSeeds, true);
        echo ($applied ? colorLine('green', "[x] ") : colorLine('yellow', "[ ] ")) . $name . PHP_EOL;
    }

    echo PHP_EOL;
    exit(0);
}

// ---------------------------------------------------------------------------
// --fresh: drop all tables
// ---------------------------------------------------------------------------

if ($fresh) {
    echo colorLine('yellow', "[FRESH] Dropping all tables...") . PHP_EOL;

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        $pdo->exec("DROP TABLE IF EXISTS `{$table}`");
        echo "  Dropped: {$table}" . PHP_EOL;
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Recreate migrations_log
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `migrations_log` (
            `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `filename`   VARCHAR(255) NOT NULL,
            `type`       ENUM('migration','seed') NOT NULL,
            `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_migrations_log_filename` (`filename`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Force seed to also run after fresh
    $runSeed = true;
    echo colorLine('green', "[FRESH] Done. Running all migrations and seeds...") . PHP_EOL . PHP_EOL;
}

// ---------------------------------------------------------------------------
// Run migrations
// ---------------------------------------------------------------------------

if (!$seedOnly) {
    $migrationsDir     = __DIR__ . '/migrations';
    $appliedMigrations = getApplied($pdo, 'migration');
    $files             = getSqlFiles($migrationsDir);

    echo "=== Running Migrations ===" . PHP_EOL;

    $ran = 0;
    foreach ($files as $file) {
        $name = basename($file);
        if (in_array($name, $appliedMigrations, true)) {
            echo colorLine('green', "  [skip] ") . $name . PHP_EOL;
            continue;
        }

        try {
            runSqlFile($pdo, $file);
            markApplied($pdo, $name, 'migration');
            echo colorLine('green', "  [ok]   ") . $name . PHP_EOL;
            $ran++;
        } catch (PDOException $e) {
            echo colorLine('red', "  [FAIL] ") . $name . ": " . $e->getMessage() . PHP_EOL;
            exit(1);
        }
    }

    if ($ran === 0) {
        echo colorLine('yellow', "  Nothing new to migrate.") . PHP_EOL;
    }

    echo PHP_EOL;
}

// ---------------------------------------------------------------------------
// Run seeds
// ---------------------------------------------------------------------------

if ($runSeed || $seedOnly) {
    $seedsDir     = __DIR__ . '/seeds';
    $appliedSeeds = getApplied($pdo, 'seed');
    $files        = getSqlFiles($seedsDir);

    echo "=== Running Seeds ===" . PHP_EOL;

    $ran = 0;
    foreach ($files as $file) {
        $name = basename($file);
        if (in_array($name, $appliedSeeds, true) && !$fresh) {
            echo colorLine('green', "  [skip] ") . $name . PHP_EOL;
            continue;
        }

        try {
            runSqlFile($pdo, $file);
            markApplied($pdo, $name, 'seed');
            echo colorLine('green', "  [ok]   ") . $name . PHP_EOL;
            $ran++;
        } catch (PDOException $e) {
            echo colorLine('red', "  [FAIL] ") . $name . ": " . $e->getMessage() . PHP_EOL;
            exit(1);
        }
    }

    if ($ran === 0) {
        echo colorLine('yellow', "  Nothing new to seed.") . PHP_EOL;
    }

    echo PHP_EOL;
}

echo colorLine('green', "Done.") . PHP_EOL;
