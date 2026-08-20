<?php
/**
 * TEMP read-only verification script for deploy sanity checks.
 * Uploaded to api/, run once via SSH, then deleted immediately.
 * Never writes/mutates any data. Mirrors credential-loading pattern of
 * deploy/db-dump-remote.php (reads .env via Dotenv, PDO read-only queries).
 */
declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? '3306';
$name = $_ENV['DB_NAME'] ?? '';
$user = $_ENV['DB_USER'] ?? '';
$pass = $_ENV['DB_PASS'] ?? '';

$mode = $argv[1] ?? 'index';

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (\Throwable $e) {
    fwrite(STDERR, "[ERROR] DB connect failed: " . $e->getMessage() . "\n");
    exit(1);
}

if ($mode === 'index') {
    $stmt = $pdo->query("SHOW INDEX FROM material_views WHERE Key_name = 'idx_mv_session_viewer'");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) === 0) {
        echo "INDEX_MISSING\n";
    } else {
        echo "INDEX_FOUND rows=" . count($rows) . "\n";
        foreach ($rows as $r) {
            echo "  col={$r['Column_name']} seq={$r['Seq_in_index']} non_unique={$r['Non_unique']}\n";
        }
    }
} elseif ($mode === 'sample-session') {
    // Read-only: find a real active session that has at least one material
    // attached, to use for a public-flow smoke test. NO writes.
    $sql = "SELECT vs.doctor_token, vsm.material_id, m.title
            FROM visit_sessions vs
            JOIN visit_session_materials vsm ON vsm.visit_session_id = vs.id
            JOIN materials m ON m.id = vsm.material_id
            WHERE vs.active = 1 AND m.is_visible = 1
            ORDER BY vs.created_at DESC
            LIMIT 1";
    $stmt = $pdo->query($sql);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        echo "NO_SAMPLE_FOUND\n";
    } else {
        echo "TOKEN={$row['doctor_token']}\n";
        echo "MATERIAL_ID={$row['material_id']}\n";
        echo "MATERIAL_TITLE={$row['title']}\n";
    }
} else {
    fwrite(STDERR, "Unknown mode\n");
    exit(1);
}
