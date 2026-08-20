<?php

declare(strict_types=1);

/**
 * MEDMETRIC - Synthetic Metrics Seeder (DEVELOPMENT ONLY)
 *
 * Generates realistic-looking visit_sessions / visit_session_materials /
 * material_views / visit_session_comments (and, only where an organization
 * has none, a brand + materials to hang them off) so both the org-level
 * /metrics dashboard AND the rep-scoped /rep/metrics module
 * (sdd/rep-metrics-module) have enough volume over the last N days to be
 * visually evaluable locally — instead of the 0..8 range you get with the
 * handful of manually-created rows. Reused as-is for rep-metrics rather
 * than duplicated into a parallel seed script: rep metrics are derived
 * from these exact same tables, scoped by `rep_id` (see
 * App\Infrastructure\Persistence\RepMetrics\DbRepMetricsRepository).
 *
 * HARD GUARD: refuses to run when APP_ENV=production. This script is not
 * safe to run against a real tenant's data (it invents visits/doctors/views).
 *
 * Idempotent: every row this script creates is tagged so it can be found
 * and removed again before re-seeding (or on its own via --reset). Nothing
 * un-tagged is ever touched.
 *
 *   Materials created by this script  -> title   starts with SEED_PREFIX
 *   Brands created by this script     -> name    starts with SEED_PREFIX
 *   Visit sessions created by this script -> doctor_name starts with SEED_PREFIX
 *   Comments created by this script   -> body    starts with SEED_PREFIX
 *   Material views created by this script -> ip_address starts with SEED_IP_PREFIX
 *     (kept OUT of the tag-by-text convention on purpose: user_agent stays a
 *     realistic, varied string so the "Registro de visualizaciones" table
 *     looks real; ip_address is not rendered in any UI list, so it is safe
 *     to use as the unambiguous machine-readable marker for cleanup)
 *
 * DRY RUN IS THE DEFAULT: only prints what exists / what would be generated.
 * Nothing is written without --confirm.
 *
 * Usage:
 *   php bin/seed_metrics_dev.php                 # Dry run
 *   php bin/seed_metrics_dev.php --confirm        # Clean previous seed + generate fresh 90-day data
 *   php bin/seed_metrics_dev.php --reset --confirm  # Only remove previously-seeded rows, insert nothing
 *   php bin/seed_metrics_dev.php --confirm --days=30  # Custom window (default 90)
 */

use App\Infrastructure\Database\Connection;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// ---------------------------------------------------------------------------
// HARD PRODUCTION GUARD - do this before anything else touches the DB.
// ---------------------------------------------------------------------------

$appEnv = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: '';
if (strtolower((string) $appEnv) === 'production') {
    fwrite(STDERR, "[ABORT] APP_ENV=production. This script generates FAKE data and must never run against production." . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Config / tags
// ---------------------------------------------------------------------------

const SEED_PREFIX = '[DEV SEED] ';
const SEED_IP_PREFIX = '203.0.113.'; // TEST-NET-3 (RFC 5737) - reserved for documentation/examples, never routable.
const DEFAULT_DAYS = 90;

const REP_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
];

const DOCTOR_USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

const FAKE_DOCTOR_NAMES = [
    'Dr. Ignacio Vergara', 'Dra. Camila Rojas', 'Dr. Matias Contreras', 'Dra. Fernanda Munoz',
    'Dr. Sebastian Pizarro', 'Dra. Valentina Soto', 'Dr. Cristobal Araya', 'Dra. Josefa Diaz',
    'Dr. Tomas Espinoza', 'Dra. Antonia Fuentes', 'Dr. Benjamin Reyes', 'Dra. Isidora Cortes',
    'Dr. Vicente Morales', 'Dra. Emilia Vasquez', 'Dr. Agustin Silva', 'Dra. Martina Bravo',
];

const FAKE_VIDEO_IDS = ['nP3W-1L8d5s', 'r7Qovpa_dPY', 'k4Q9j3sD2mE', 'x8Bv2wZ1nRt', 'q9Lm4Kd0PxA'];

/** Realistic short doctor comments (es-CL), left on a subset of doctor-viewed sessions. */
const DOCTOR_COMMENT_TEMPLATES = [
    'Muy util el material, gracias por compartirlo.',
    'Me gustaria recibir mas informacion sobre la dosis pediatrica.',
    'Excelente presentacion, la voy a recomendar a mis colegas.',
    'Falta informacion sobre interacciones con otros farmacos.',
    'Buen resumen, lo revise con el equipo de enfermeria.',
    'Podrian enviarme la version en PDF para imprimir?',
    'Justo lo que necesitaba para la consulta de hoy.',
    'Interesante, aunque esperaba mas datos clinicos.',
    'Gracias por la visita, quedo atento a nuevos estudios.',
    'El video quedo un poco largo, pero el contenido es bueno.',
];

/** @return list<int> */
function columnList(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function scalar(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $v = $stmt->fetchColumn();
    return $v === false ? 0 : (int) $v;
}

function heading(string $title): void
{
    echo PHP_EOL . str_repeat('-', 74) . PHP_EOL . $title . PHP_EOL . str_repeat('-', 74) . PHP_EOL;
}

/**
 * Batch-insert rows (list of assoc arrays, all sharing the same keys) into
 * $table in chunks of $chunkSize, using one multi-row INSERT per chunk.
 */
function batchInsert(PDO $pdo, string $table, array $columns, array $rows, int $chunkSize = 400): int
{
    if ($rows === []) {
        return 0;
    }

    $colSql = '`' . implode('`, `', $columns) . '`';
    $rowPlaceholder = '(' . implode(', ', array_fill(0, count($columns), '?')) . ')';
    $inserted = 0;

    foreach (array_chunk($rows, $chunkSize) as $chunk) {
        $placeholders = implode(', ', array_fill(0, count($chunk), $rowPlaceholder));
        $sql = "INSERT INTO `{$table}` ({$colSql}) VALUES {$placeholders}";
        $stmt = $pdo->prepare($sql);

        $values = [];
        foreach ($chunk as $row) {
            foreach ($columns as $col) {
                $values[] = $row[$col];
            }
        }

        $stmt->execute($values);
        $inserted += count($chunk);
    }

    return $inserted;
}

/** Random int weighted toward the middle of [$min,$max] using two dice-average (feels less "flat"). */
function fuzzyRand(int $min, int $max): int
{
    if ($max <= $min) {
        return $min;
    }
    $a = random_int($min, $max);
    $b = random_int($min, $max);
    return (int) round(($a + $b) / 2);
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

$args = array_slice($argv, 1);
$confirm = in_array('--confirm', $args, true);
$resetOnly = in_array('--reset', $args, true);
$days = DEFAULT_DAYS;
foreach ($args as $arg) {
    if (str_starts_with($arg, '--days=')) {
        $days = max(1, (int) substr($arg, 7));
    }
}

echo "=== MEDMETRIC - Synthetic Metrics Seeder (DEV ONLY) ===" . PHP_EOL;
echo "APP_ENV=" . ($appEnv !== '' ? $appEnv : '(unset)') . PHP_EOL;
echo "Mode: " . ($confirm ? '*** CONFIRM (WRITES) ***' : 'DRY RUN (read-only)') . ($resetOnly ? ' [--reset only]' : '') . PHP_EOL;
echo "Window: last {$days} day(s)" . PHP_EOL;

// ---------------------------------------------------------------------------
// Cleanup helpers (idempotency) - tag-based, mirrors bin/cleanup_prod_2026_08.php's
// documented SET NULL / RESTRICT ordering gotchas.
// ---------------------------------------------------------------------------

function seedCounts(PDO $pdo): array
{
    return [
        'material_views (ip LIKE seed range)' => scalar($pdo, "SELECT COUNT(*) AS c FROM material_views WHERE ip_address LIKE :p", [':p' => SEED_IP_PREFIX . '%']),
        'visit_session_comments (seed)' => scalar($pdo, "SELECT COUNT(*) AS c FROM visit_session_comments WHERE body LIKE :p", [':p' => SEED_PREFIX . '%']),
        'visit_session_materials (of seed sessions)' => scalar($pdo, "SELECT COUNT(*) AS c FROM visit_session_materials vsm JOIN visit_sessions vs ON vs.id = vsm.visit_session_id WHERE vs.doctor_name LIKE :p", [':p' => SEED_PREFIX . '%']),
        'visit_sessions (seed)' => scalar($pdo, "SELECT COUNT(*) AS c FROM visit_sessions WHERE doctor_name LIKE :p", [':p' => SEED_PREFIX . '%']),
        'materials (seed)' => scalar($pdo, "SELECT COUNT(*) AS c FROM materials WHERE title LIKE :p", [':p' => SEED_PREFIX . '%']),
        'manager_brands (of seed brands)' => scalar($pdo, "SELECT COUNT(*) AS c FROM manager_brands mb JOIN brands b ON b.id = mb.brand_id WHERE b.name LIKE :p", [':p' => SEED_PREFIX . '%']),
        'brands (seed)' => scalar($pdo, "SELECT COUNT(*) AS c FROM brands WHERE name LIKE :p", [':p' => SEED_PREFIX . '%']),
    ];
}

function printCountMap(array $counts, string $heading): void
{
    echo $heading . PHP_EOL;
    foreach ($counts as $label => $n) {
        printf("  %-46s %d row(s)%s", $label, $n, PHP_EOL);
    }
    echo PHP_EOL;
}

function cleanupSeed(PDO $pdo): array
{
    $deleted = [];

    $deleted['material_views'] = $pdo->prepare("DELETE FROM material_views WHERE ip_address LIKE :p");
    $deleted['material_views']->execute([':p' => SEED_IP_PREFIX . '%']);
    $deleted['material_views'] = $deleted['material_views']->rowCount();

    // Explicit delete (rather than relying solely on visit_sessions'
    // ON DELETE CASCADE for fk_vsc_session) so the row count below is
    // accurate and this function stays idempotent/self-contained on its own.
    $stmt = $pdo->prepare("DELETE FROM visit_session_comments WHERE body LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['visit_session_comments'] = $stmt->rowCount();

    $stmt = $pdo->prepare("DELETE vsm FROM visit_session_materials vsm JOIN visit_sessions vs ON vs.id = vsm.visit_session_id WHERE vs.doctor_name LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['visit_session_materials'] = $stmt->rowCount();

    $stmt = $pdo->prepare("DELETE FROM visit_sessions WHERE doctor_name LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['visit_sessions'] = $stmt->rowCount();

    $stmt = $pdo->prepare("DELETE FROM materials WHERE title LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['materials'] = $stmt->rowCount();

    $stmt = $pdo->prepare("DELETE mb FROM manager_brands mb JOIN brands b ON b.id = mb.brand_id WHERE b.name LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['manager_brands'] = $stmt->rowCount();

    $stmt = $pdo->prepare("DELETE FROM brands WHERE name LIKE :p");
    $stmt->execute([':p' => SEED_PREFIX . '%']);
    $deleted['brands'] = $stmt->rowCount();

    return $deleted;
}

// ---------------------------------------------------------------------------
// Dry run: report what exists / what would be cleaned, then stop.
// ---------------------------------------------------------------------------

if (!$confirm) {
    heading('CURRENT SEED-TAGGED ROWS (would be removed and re-generated)');
    printCountMap(seedCounts($pdo), 'Row counts:');

    if (!$resetOnly) {
        $orgs = columnList($pdo, "SELECT id FROM organizations WHERE active = 1 ORDER BY id");
        heading('PROJECTED GENERATION (rough, not exact)');
        echo "  Organizations in scope: " . implode(', ', $orgs) . PHP_EOL;
        echo "  Window: last {$days} day(s)" . PHP_EOL;
        echo "  Per org/day (weekday): ~8-18 sessions, ~1-3 materials/session, ~5-25 extra rep views, ~3-20 extra doctor views" . PHP_EOL;
        echo "  Per org/day (weekend): ~2-6 sessions, lighter extras" . PHP_EOL;
        echo "  ~8% of days get a 1.6x-2.2x spike multiplier" . PHP_EOL;
        echo "  Estimated total material_views: ~" . (count($orgs) * $days * 65) . " (order of magnitude)" . PHP_EOL;
        echo "  ~25% of doctor-viewed sessions per org get 1 doctor comment (visit_session_comments)" . PHP_EOL;
    }

    echo PHP_EOL . "DRY RUN - nothing was written. Re-run with --confirm to execute." . PHP_EOL;
    exit(0);
}

// ---------------------------------------------------------------------------
// --confirm: run for real, inside one transaction.
// ---------------------------------------------------------------------------

heading('BEFORE');
$before = seedCounts($pdo);
printCountMap($before, 'Seed-tagged row counts BEFORE:');

try {
    $pdo->beginTransaction();

    heading('CLEANUP (idempotency - remove any previous seed run)');
    $deleted = cleanupSeed($pdo);
    foreach ($deleted as $table => $n) {
        printf("  %-28s %d row(s) deleted%s", $table, $n, PHP_EOL);
    }

    if ($resetOnly) {
        $pdo->commit();
        heading('AFTER (--reset only, nothing generated)');
        printCountMap(seedCounts($pdo), 'Seed-tagged row counts AFTER:');
        echo PHP_EOL . "OK - previous seed data removed. Nothing new was generated (--reset)." . PHP_EOL;
        exit(0);
    }

    // -------------------------------------------------------------------
    // Ensure catalog: every active org gets a brand + at least one
    // APPROVED material per type (pdf/video/link). Reuses existing
    // approved materials/brands where present; only creates what's missing.
    // -------------------------------------------------------------------

    heading('CATALOG (ensuring brand + materials per org/type)');

    $repRoleId = scalar($pdo, "SELECT id FROM roles WHERE name = 'rep'");
    $managerRoleId = scalar($pdo, "SELECT id FROM roles WHERE name = 'manager'");

    $orgs = columnList($pdo, "SELECT id FROM organizations WHERE active = 1 ORDER BY id");

    $orgReps = [];
    $orgMaterials = []; // org_id => [material_id, ...] (approved, any type, real + synthetic)
    $orgTimezone = [];

    $insMaterial = $pdo->prepare(
        "INSERT INTO materials
            (organization_id, brand_id, manager_id, title, description, type, status, storage_driver, storage_path, external_url, approved_at, approved_by, created_at, updated_at)
         VALUES (:org, :brand, :manager, :title, :description, :type, 'approved', :driver, :path, :url, :approved_at, :approved_by, :created_at, :updated_at)"
    );
    $insBrand = $pdo->prepare(
        "INSERT INTO brands (organization_id, name, description, active, created_at, updated_at) VALUES (:org, :name, :description, 1, NOW(), NOW())"
    );
    $insManagerBrand = $pdo->prepare(
        "INSERT INTO manager_brands (manager_id, brand_id, active, created_at, updated_at) VALUES (:manager, :brand, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE active = 1"
    );

    $catalogSeedAt = (new DateTimeImmutable('-' . ($days + 30) . ' days'))->format('Y-m-d H:i:s');

    foreach ($orgs as $orgId) {
        $tz = (string) $pdo->query("SELECT timezone FROM organizations WHERE id = {$orgId}")->fetchColumn();
        $orgTimezone[$orgId] = $tz !== '' ? $tz : 'America/Santiago';

        $reps = columnList($pdo, "SELECT id FROM users WHERE organization_id = :org AND role_id = :role AND active = 1", [':org' => $orgId, ':role' => $repRoleId]);
        $orgReps[$orgId] = $reps;

        if ($reps === []) {
            echo "  org {$orgId}: no active reps - skipping entirely (would generate 0 views)." . PHP_EOL;
            $orgMaterials[$orgId] = [];
            continue;
        }

        $managers = columnList($pdo, "SELECT id FROM users WHERE organization_id = :org AND role_id = :role AND active = 1", [':org' => $orgId, ':role' => $managerRoleId]);

        $brands = columnList($pdo, "SELECT id FROM brands WHERE organization_id = :org AND active = 1", [':org' => $orgId]);
        if ($brands === [] && $managers !== []) {
            $insBrand->execute([
                ':org' => $orgId,
                ':name' => SEED_PREFIX . 'Marca Demo',
                ':description' => 'Marca generada por el seeder de metricas de desarrollo.',
            ]);
            $newBrandId = (int) $pdo->lastInsertId();
            $insManagerBrand->execute([':manager' => $managers[0], ':brand' => $newBrandId]);
            $brands = [$newBrandId];
            echo "  org {$orgId}: created brand '" . SEED_PREFIX . "Marca Demo' (id {$newBrandId}), linked to manager {$managers[0]}." . PHP_EOL;
        }

        if ($brands === [] || $managers === []) {
            echo "  org {$orgId}: no brand/manager available - skipping material creation." . PHP_EOL;
        }

        // manager_id -> brand_id pairs (active), for round-robin assignment.
        $pairs = [];
        if ($brands !== [] && $managers !== []) {
            $mbRows = $pdo->prepare("SELECT manager_id, brand_id FROM manager_brands WHERE active = 1 AND brand_id IN (" . implode(',', $brands) . ")");
            $mbRows->execute();
            foreach ($mbRows->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $pairs[] = [(int) $row['manager_id'], (int) $row['brand_id']];
            }
            if ($pairs === []) {
                $pairs[] = [$managers[0], $brands[0]];
            }
        }

        $materialIds = columnList($pdo, "SELECT id FROM materials WHERE organization_id = :org AND status = 'approved'", [':org' => $orgId]);

        $typesPresent = $pairs === [] ? [] : array_column(
            (array) $pdo->query("SELECT DISTINCT type FROM materials WHERE organization_id = {$orgId} AND status = 'approved'")->fetchAll(PDO::FETCH_ASSOC),
            'type'
        );

        $pairIdx = 0;
        foreach (['pdf', 'video', 'link'] as $type) {
            if (in_array($type, $typesPresent, true) || $pairs === []) {
                continue;
            }
            [$managerId, $brandId] = $pairs[$pairIdx % count($pairs)];
            $pairIdx++;

            $title = SEED_PREFIX . ucfirst($type) . ' Demo ' . $orgId . '-' . random_int(100, 999);
            $params = [
                ':org' => $orgId,
                ':brand' => $brandId,
                ':manager' => $managerId,
                ':title' => $title,
                ':description' => 'Material sintetico generado para poblar metricas en desarrollo.',
                ':type' => $type,
                ':driver' => 'local',
                ':path' => null,
                ':url' => null,
                ':approved_at' => $catalogSeedAt,
                ':approved_by' => $managerId,
                ':created_at' => $catalogSeedAt,
                ':updated_at' => $catalogSeedAt,
            ];

            if ($type === 'pdf') {
                $params[':path'] = 'materials/dev-seed/placeholder-' . $orgId . '-' . random_int(1000, 9999) . '.pdf';
            } elseif ($type === 'video') {
                $params[':url'] = 'https://www.youtube.com/watch?v=' . FAKE_VIDEO_IDS[array_rand(FAKE_VIDEO_IDS)];
            } else { // link
                $params[':url'] = 'https://recursos.medmetric-demo.com/material/' . strtolower($type) . '-' . random_int(1000, 9999);
            }

            $insMaterial->execute($params);
            $materialIds[] = (int) $pdo->lastInsertId();
            echo "  org {$orgId}: created material '{$title}' (type={$type}, manager={$managerId}, brand={$brandId})." . PHP_EOL;
        }

        $orgMaterials[$orgId] = $materialIds;
        echo "  org {$orgId}: " . count($materialIds) . " approved material(s) available for views, " . count($reps) . " rep(s)." . PHP_EOL;
    }

    // -------------------------------------------------------------------
    // Generate visit_sessions / visit_session_materials / material_views
    // per org, per day, over the requested window.
    // -------------------------------------------------------------------

    heading('GENERATING ' . $days . ' DAY(S) OF SESSIONS + VIEWS');

    $insSession = $pdo->prepare(
        "INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_id, doctor_name, notes, active, created_at, updated_at)
         VALUES (:org, :rep, :token, NULL, :dname, NULL, 1, :ts1, :ts2)"
    );
    $materialForSessionStmt = $pdo->prepare(
        "SELECT material_id FROM visit_session_materials WHERE visit_session_id = :sid ORDER BY RAND() LIMIT 1"
    );

    $totalSessions = 0;
    $totalVsm = 0;
    $totalViewsRep = 0;
    $totalViewsDoctor = 0;
    $totalComments = 0;

    foreach ($orgs as $orgId) {
        $reps = $orgReps[$orgId];
        $materials = $orgMaterials[$orgId];
        if ($reps === [] || $materials === []) {
            continue;
        }

        $tz = new DateTimeZone($orgTimezone[$orgId]);
        $sessionIdsSoFar = [];

        $vsmBuffer = [];
        $viewBuffer = [];

        for ($dayOffset = $days - 1; $dayOffset >= 0; $dayOffset--) {
            $localDay = (new DateTimeImmutable('today', $tz))->modify("-{$dayOffset} days");
            $dow = (int) $localDay->format('N'); // 1=Mon .. 7=Sun
            $isWeekend = $dow >= 6;

            $spike = (random_int(1, 100) <= 8) ? (1.6 + random_int(0, 6) / 10) : 1.0;

            $numSessions = (int) round(($isWeekend ? fuzzyRand(2, 6) : fuzzyRand(8, 18)) * $spike);
            $extraRep = (int) round(($isWeekend ? fuzzyRand(1, 8) : fuzzyRand(5, 25)) * $spike);
            $extraDoctor = (int) round(($isWeekend ? fuzzyRand(0, 5) : fuzzyRand(3, 20)) * $spike);

            $todaysSessionIds = [];

            for ($s = 0; $s < $numSessions; $s++) {
                $repId = $reps[array_rand($reps)];
                $hour = random_int(8, 18);
                $minute = random_int(0, 59);
                $localTs = $localDay->setTime($hour, $minute, random_int(0, 59));
                $utcTs = $localTs->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');

                $insSession->execute([
                    ':org' => $orgId,
                    ':rep' => $repId,
                    ':token' => bin2hex(random_bytes(32)),
                    ':dname' => SEED_PREFIX . FAKE_DOCTOR_NAMES[array_rand(FAKE_DOCTOR_NAMES)],
                    ':ts1' => $utcTs,
                    ':ts2' => $utcTs,
                ]);
                $sessionId = (int) $pdo->lastInsertId();
                $todaysSessionIds[] = $sessionId;
                $sessionIdsSoFar[] = $sessionId;
                $totalSessions++;

                $numMaterials = fuzzyRand(1, 3);
                $sessionMaterials = (array) array_rand(array_flip($materials), min($numMaterials, count($materials)));
                if (!is_array($sessionMaterials)) {
                    $sessionMaterials = [$sessionMaterials];
                }

                $sortOrder = 0;
                foreach ($sessionMaterials as $materialId) {
                    $vsmBuffer[] = [
                        'visit_session_id' => $sessionId,
                        'material_id' => $materialId,
                        'sort_order' => $sortOrder++,
                        'created_at' => $utcTs,
                    ];

                    $repOpened = (clone $localTs)->modify('+' . random_int(0, 10) . ' minutes');
                    $viewBuffer[] = [
                        'material_id' => $materialId,
                        'visit_session_id' => $sessionId,
                        'viewer_type' => 'rep',
                        'viewer_id' => $repId,
                        'opened_at' => $repOpened->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                        'closed_at' => null,
                        'duration_seconds' => null,
                        'user_agent' => REP_USER_AGENTS[array_rand(REP_USER_AGENTS)],
                        'ip_address' => SEED_IP_PREFIX . random_int(2, 254),
                    ];
                    $totalViewsRep++;

                    if (random_int(1, 100) <= 80) {
                        $docOpened = (clone $repOpened)->modify('+' . random_int(1, 15) . ' minutes');
                        $viewBuffer[] = [
                            'material_id' => $materialId,
                            'visit_session_id' => $sessionId,
                            'viewer_type' => 'doctor',
                            'viewer_id' => null,
                            'opened_at' => $docOpened->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                            'closed_at' => null,
                            'duration_seconds' => null,
                            'user_agent' => DOCTOR_USER_AGENTS[array_rand(DOCTOR_USER_AGENTS)],
                            'ip_address' => SEED_IP_PREFIX . random_int(2, 254),
                        ];
                        $totalViewsDoctor++;
                    }
                }
            }

            // Extra standalone rep views (browsing the library without an active session).
            for ($i = 0; $i < $extraRep; $i++) {
                $repId = $reps[array_rand($reps)];
                $materialId = $materials[array_rand($materials)];
                $hour = random_int(8, 19);
                $localTs = $localDay->setTime($hour, random_int(0, 59), random_int(0, 59));
                $viewBuffer[] = [
                    'material_id' => $materialId,
                    'visit_session_id' => null,
                    'viewer_type' => 'rep',
                    'viewer_id' => $repId,
                    'opened_at' => $localTs->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                    'closed_at' => null,
                    'duration_seconds' => null,
                    'user_agent' => REP_USER_AGENTS[array_rand(REP_USER_AGENTS)],
                    'ip_address' => SEED_IP_PREFIX . random_int(2, 254),
                ];
                $totalViewsRep++;
            }

            // Extra doctor "return visits" - re-opening a link from a real (seed) session,
            // today's or an earlier one. Doctors never reach a material without a session token.
            $pool = $todaysSessionIds !== [] ? array_merge($sessionIdsSoFar, $todaysSessionIds) : $sessionIdsSoFar;
            if ($pool !== []) {
                for ($i = 0; $i < $extraDoctor; $i++) {
                    $sessionId = $pool[array_rand($pool)];
                    $materialId = $materials[array_rand($materials)];
                    $hour = random_int(8, 21);
                    $localTs = $localDay->setTime($hour, random_int(0, 59), random_int(0, 59));
                    $viewBuffer[] = [
                        'material_id' => $materialId,
                        'visit_session_id' => $sessionId,
                        'viewer_type' => 'doctor',
                        'viewer_id' => null,
                        'opened_at' => $localTs->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                        'closed_at' => null,
                        'duration_seconds' => null,
                        'user_agent' => DOCTOR_USER_AGENTS[array_rand(DOCTOR_USER_AGENTS)],
                        'ip_address' => SEED_IP_PREFIX . random_int(2, 254),
                    ];
                    $totalViewsDoctor++;
                }
            }

            // Flush buffers periodically to keep memory bounded.
            if (count($viewBuffer) >= 2000) {
                $totalVsm += batchInsert($pdo, 'visit_session_materials', ['visit_session_id', 'material_id', 'sort_order', 'created_at'], $vsmBuffer);
                batchInsert($pdo, 'material_views', ['material_id', 'visit_session_id', 'viewer_type', 'viewer_id', 'opened_at', 'closed_at', 'duration_seconds', 'user_agent', 'ip_address'], $viewBuffer);
                $vsmBuffer = [];
                $viewBuffer = [];
            }
        }

        // Final flush for this org.
        $totalVsm += batchInsert($pdo, 'visit_session_materials', ['visit_session_id', 'material_id', 'sort_order', 'created_at'], $vsmBuffer);
        batchInsert($pdo, 'material_views', ['material_id', 'visit_session_id', 'viewer_type', 'viewer_id', 'opened_at', 'closed_at', 'duration_seconds', 'user_agent', 'ip_address'], $viewBuffer);

        echo "  org {$orgId}: done (" . count($sessionIdsSoFar) . " session(s) generated)." . PHP_EOL;

        // ---------------------------------------------------------------
        // Doctor comments (sdd/rep-metrics-module Phase 5): ~25% of this
        // org's doctor-viewed seed sessions get one realistic comment,
        // timed shortly after the session's last doctor open. Exercises
        // DbRepMetricsRepository::sessions()'s comment_count aggregate
        // with real, non-zero data instead of always 0.
        // ---------------------------------------------------------------
        if ($sessionIdsSoFar !== []) {
            $placeholders = implode(',', array_fill(0, count($sessionIdsSoFar), '?'));
            $viewedStmt = $pdo->prepare(
                "SELECT visit_session_id, MAX(opened_at) AS last_open
                 FROM material_views
                 WHERE viewer_type = 'doctor' AND visit_session_id IN ({$placeholders})
                 GROUP BY visit_session_id"
            );
            $viewedStmt->execute($sessionIdsSoFar);

            $commentRows = [];
            foreach ($viewedStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (random_int(1, 100) > 25) {
                    continue; // ~25% of doctor-viewed sessions get a comment.
                }

                $sessionId = (int) $row['visit_session_id'];

                // ~40% of comments target one specific material of the
                // session; the rest are general/open comments (material_id NULL).
                $materialId = null;
                if (random_int(1, 100) <= 40) {
                    $materialForSessionStmt->execute([':sid' => $sessionId]);
                    $picked = $materialForSessionStmt->fetchColumn();
                    $materialId = $picked !== false ? (int) $picked : null;
                }

                $createdAt = (new DateTimeImmutable((string) $row['last_open'], new DateTimeZone('UTC')))
                    ->modify('+' . random_int(5, 240) . ' minutes')
                    ->format('Y-m-d H:i:s');

                $commentRows[] = [
                    'visit_session_id' => $sessionId,
                    'material_id' => $materialId,
                    'organization_id' => $orgId,
                    'parent_id' => null,
                    'author_type' => 'doctor',
                    'author_user_id' => null,
                    'doctor_id' => null,
                    'body' => SEED_PREFIX . DOCTOR_COMMENT_TEMPLATES[array_rand(DOCTOR_COMMENT_TEMPLATES)],
                    'user_agent' => DOCTOR_USER_AGENTS[array_rand(DOCTOR_USER_AGENTS)],
                    'ip_address' => SEED_IP_PREFIX . random_int(2, 254),
                    'active' => 1,
                    'created_at' => $createdAt,
                    'updated_at' => null,
                ];
            }

            $totalComments += batchInsert(
                $pdo,
                'visit_session_comments',
                ['visit_session_id', 'material_id', 'organization_id', 'parent_id', 'author_type', 'author_user_id', 'doctor_id', 'body', 'user_agent', 'ip_address', 'active', 'created_at', 'updated_at'],
                $commentRows
            );
            echo "  org {$orgId}: " . count($commentRows) . " doctor comment(s) generated." . PHP_EOL;
        }
    }

    $pdo->commit();

    heading('SUMMARY');
    printf("  visit_sessions created:            %d%s", $totalSessions, PHP_EOL);
    printf("  visit_session_materials created:   %d%s", $totalVsm, PHP_EOL);
    printf("  material_views created (rep):      %d%s", $totalViewsRep, PHP_EOL);
    printf("  material_views created (doctor):   %d%s", $totalViewsDoctor, PHP_EOL);
    printf("  material_views created (total):    %d%s", $totalViewsRep + $totalViewsDoctor, PHP_EOL);
    printf("  visit_session_comments created:    %d%s", $totalComments, PHP_EOL);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, PHP_EOL . "[ERROR] Seed failed, transaction rolled back: " . $e->getMessage() . PHP_EOL);
    fwrite(STDERR, $e->getTraceAsString() . PHP_EOL);
    exit(1);
}

heading('AFTER');
printCountMap(seedCounts($pdo), 'Seed-tagged row counts AFTER:');

echo PHP_EOL . "OK - synthetic metrics data generated. Re-run anytime with --confirm (idempotent) or purge with --reset --confirm." . PHP_EOL;
exit(0);
