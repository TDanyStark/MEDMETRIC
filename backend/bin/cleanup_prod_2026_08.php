<?php

declare(strict_types=1);

/**
 * MEDMETRIC - Production data cleanup, August 2026 (one-off maintenance script)
 *
 * APPROVED DESTRUCTIVE MAINTENANCE. Runs four operations, in this exact order,
 * inside a SINGLE transaction when executed with --confirm:
 *
 *   OP 1  Merge user 13 (Claudia Fernandez) INTO user 26 (Maria Riveros),
 *         rename 26 to "Maria Ignacia Riveros Fuentes" (accented), delete 13.
 *   OP 2  Delete doctor 4370 ("Prueba - Leonardo Vargas") and ALL its data.
 *   OP 3  Delete user 14 (Johanna Jofre) and her remaining metrics.
 *   OP 4  Delete user 27 (Belen Berrios) — zero metrics.
 *
 * DRY RUN IS THE DEFAULT: it only SELECTs and prints how many rows each step
 * WOULD affect. Nothing is written without --confirm.
 *
 * Usage:
 *   php bin/cleanup_prod_2026_08.php            # Dry run (counts only)
 *   php bin/cleanup_prod_2026_08.php --confirm  # Real execution (1 transaction)
 *
 * ---------------------------------------------------------------------------
 * SCHEMA GOTCHAS THIS SCRIPT DEFENDS AGAINST (verified with SHOW CREATE TABLE
 * against production on 2026-08-12):
 *
 *  1. material_views.visit_session_id  -> ON DELETE SET NULL
 *     study_views.visit_session_id     -> ON DELETE SET NULL
 *     Deleting a visit_session does NOT delete its views, it ORPHANS them
 *     (visit_session_id becomes NULL). They must be deleted FIRST, explicitly.
 *
 *  2. visit_sessions.doctor_id -> no ON DELETE clause = RESTRICT.
 *     visit_sessions.rep_id    -> no ON DELETE clause = RESTRICT.
 *     Sessions must be deleted before their doctor / rep.
 *
 *  3. materials.manager_id -> no ON DELETE clause = RESTRICT.
 *     A user that owns materials CANNOT be deleted. Asserted before deleting.
 *
 *  4. rep_manager_access has UNIQUE KEY uq_rep_manager (rep_id, manager_id)
 *     manager_brands     has UNIQUE KEY uq_manager_brand (manager_id, brand_id)
 *     A blind "UPDATE ... SET rep_id = 26 WHERE rep_id = 13" throws a duplicate
 *     key error when the target already has the same pair. Colliding source rows
 *     are deleted first; MySQL forbids a subquery on the table being deleted, so
 *     the collision list is materialized into PHP before the DELETE runs.
 * ---------------------------------------------------------------------------
 */

use App\Infrastructure\Database\Connection;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// ---------------------------------------------------------------------------
// Auditable target IDs. Nothing below hardcodes an ID outside this block.
// ---------------------------------------------------------------------------

/** OP 1 - user merged away and then deleted (Claudia Fernandez). */
const MERGE_SOURCE_USER_ID = 13;

/** OP 1 - user that absorbs everything from MERGE_SOURCE_USER_ID (Maria Riveros). */
const MERGE_TARGET_USER_ID = 26;

/**
 * OP 1 - new display name for MERGE_TARGET_USER_ID.
 * Written with a \u{} escape on purpose: this guarantees the exact UTF-8 bytes
 * for "í" regardless of how this file is encoded/transferred to the server.
 */
const MERGE_TARGET_NEW_NAME = "Mar\u{00ED}a Ignacia Riveros Fuentes";

/** OP 1 - email of MERGE_TARGET_USER_ID, must stay untouched. Used as a guard. */
const MERGE_TARGET_EMAIL = 'maria.riveros@steincares.com';

/** OP 2 - test doctor to purge ("Prueba - Leonardo Vargas"). */
const DELETE_DOCTOR_ID = 4370;

/** OP 3 - user to delete with her remaining metrics (Johanna Jofre). */
const DELETE_USER_JOHANNA_ID = 14;

/** OP 4 - user to delete, has no metrics (Belen Berrios). */
const DELETE_USER_BELEN_ID = 27;

/** Identity guards: id => expected name fragment. Mismatch = ABORT. */
const EXPECTED_USER_NAMES = [
    MERGE_SOURCE_USER_ID     => 'Claudia',
    MERGE_TARGET_USER_ID     => 'Riveros',
    DELETE_USER_JOHANNA_ID   => 'Johanna',
    DELETE_USER_BELEN_ID     => 'Belen',
];

const EXPECTED_DOCTOR_NAME_FRAGMENT = 'Leonardo Vargas';

/** Tables reported in the before/after summary. */
const REPORTED_TABLES = [
    'users',
    'doctors',
    'visit_sessions',
    'visit_session_materials',
    'material_views',
    'study_views',
    'visit_session_comments',
    'rep_manager_access',
    'manager_brands',
    'materials',
];

/**
 * Every column in the schema that references users.id, as [table, column].
 * Used for the blast-radius report and for the pre-delete safety assertions.
 */
const USER_FK_COLUMNS = [
    ['visit_sessions',         'rep_id'],
    ['material_views',         'viewer_id'],
    ['study_views',            'viewer_id'],
    ['visit_session_comments', 'author_user_id'],
    ['materials',              'manager_id'],
    ['materials',              'approved_by'],
    ['rep_manager_access',     'rep_id'],
    ['rep_manager_access',     'manager_id'],
    ['manager_brands',         'manager_id'],
    ['doctors',                'assigned_rep_id'],
    ['doctors',                'created_by_id'],
];

/**
 * FK columns that CASCADE when the user row is deleted, so they are allowed to
 * be non-zero at delete time. Everything else in USER_FK_COLUMNS must be 0.
 */
const USER_FK_CASCADING = [
    'rep_manager_access.rep_id',
    'rep_manager_access.manager_id',
    'manager_brands.manager_id',
];

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

$args    = array_slice($argv, 1);
$confirm = in_array('--confirm', $args, true);

/** @var array<string,int> Rows actually affected (or that would be), per step. */
$affected = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

final class Abort extends RuntimeException
{
}

function countRows(PDO $pdo, string $table): int
{
    return (int) $pdo->query("SELECT COUNT(*) AS c FROM `{$table}`")->fetch()['c'];
}

function scalar(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return (int) $stmt->fetch()['c'];
}

/** @return list<int> */
function columnList(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/**
 * Renders a list of ints as a safe SQL IN() list. Values are cast to int, so
 * no injection is possible; an empty list yields "(NULL)" which matches nothing
 * instead of producing invalid "IN ()" syntax.
 */
function inList(array $ids): string
{
    if ($ids === []) {
        return '(NULL)';
    }

    return '(' . implode(',', array_map('intval', $ids)) . ')';
}

function heading(string $title): void
{
    echo PHP_EOL . str_repeat('-', 74) . PHP_EOL . $title . PHP_EOL . str_repeat('-', 74) . PHP_EOL;
}

/**
 * A single auditable step: counts the rows it targets, and — only under
 * --confirm — executes the write and reports the real affected-row count.
 */
function step(
    PDO $pdo,
    bool $confirm,
    array &$affected,
    string $label,
    string $countSql,
    string $writeSql,
    array $params = []
): int {
    $expected = scalar($pdo, $countSql, $params);

    if (!$confirm) {
        printf("  [dry] %-58s %4d row(s)%s", $label, $expected, PHP_EOL);
        $affected[$label] = $expected;

        return $expected;
    }

    $stmt = $pdo->prepare($writeSql);
    $stmt->execute($params);
    $real = $stmt->rowCount();

    $flag = ($real === $expected) ? ' ' : ' <-- differs from expected ' . $expected;
    printf("  [RUN] %-58s %4d row(s)%s%s", $label, $real, $flag, PHP_EOL);
    $affected[$label] = $real;

    return $real;
}

function printCounts(PDO $pdo, string $heading): array
{
    echo $heading . PHP_EOL;
    $out = [];
    foreach (REPORTED_TABLES as $table) {
        $out[$table] = countRows($pdo, $table);
        printf("  %-28s %d row(s)%s", $table, $out[$table], PHP_EOL);
    }
    echo PHP_EOL;

    return $out;
}

function printBlastRadius(PDO $pdo, int $userId, string $label): array
{
    echo "  Blast radius for user {$userId} ({$label}):" . PHP_EOL;
    $out = [];
    foreach (USER_FK_COLUMNS as [$table, $column]) {
        $n = scalar($pdo, "SELECT COUNT(*) AS c FROM `{$table}` WHERE `{$column}` = :id", [':id' => $userId]);
        $out["{$table}.{$column}"] = $n;
        printf("    %-28s %-18s %4d%s", $table, $column, $n, PHP_EOL);
    }
    echo PHP_EOL;

    return $out;
}

/**
 * Guards a user delete: every FK column referencing users.id must be 0, except
 * the ones declared ON DELETE CASCADE in USER_FK_CASCADING.
 */
function assertUserDeletable(PDO $pdo, int $userId): void
{
    foreach (USER_FK_COLUMNS as [$table, $column]) {
        $key = "{$table}.{$column}";
        if (in_array($key, USER_FK_CASCADING, true)) {
            continue;
        }
        $n = scalar($pdo, "SELECT COUNT(*) AS c FROM `{$table}` WHERE `{$column}` = :id", [':id' => $userId]);
        if ($n !== 0) {
            throw new Abort("User {$userId} still referenced by {$key} ({$n} row(s)). Refusing to delete.");
        }
    }
}

/**
 * Reassigns a user id on a table protected by a composite UNIQUE key, without
 * ever tripping a duplicate-key error.
 *
 * $moveColumn is the column being changed (source -> target); $pairColumn is
 * the other half of the UNIQUE key. Source rows whose $pairColumn value already
 * exists for the target are deleted; the rest are updated.
 *
 * The collision list is materialized into PHP first because MySQL cannot
 * SELECT from the same table it is deleting from within one statement.
 */
function reassignWithUniqueGuard(
    PDO $pdo,
    bool $confirm,
    array &$affected,
    string $table,
    string $moveColumn,
    string $pairColumn,
    int $sourceId,
    int $targetId
): void {
    $targetPairs = columnList(
        $pdo,
        "SELECT `{$pairColumn}` FROM `{$table}` WHERE `{$moveColumn}` = :id",
        [':id' => $targetId]
    );

    $collidingIds = columnList(
        $pdo,
        "SELECT `id` FROM `{$table}` WHERE `{$moveColumn}` = :id AND `{$pairColumn}` IN " . inList($targetPairs),
        [':id' => $sourceId]
    );

    step(
        $pdo,
        $confirm,
        $affected,
        "{$table}: drop duplicate {$moveColumn}={$sourceId} rows colliding with {$targetId}",
        "SELECT COUNT(*) AS c FROM `{$table}` WHERE `id` IN " . inList($collidingIds),
        "DELETE FROM `{$table}` WHERE `id` IN " . inList($collidingIds)
    );

    step(
        $pdo,
        $confirm,
        $affected,
        "{$table}: reassign surviving {$moveColumn} {$sourceId} -> {$targetId}",
        "SELECT COUNT(*) AS c FROM `{$table}` WHERE `{$moveColumn}` = :id"
            . ($collidingIds === [] ? '' : ' AND `id` NOT IN ' . inList($collidingIds)),
        "UPDATE `{$table}` SET `{$moveColumn}` = " . (int) $targetId . " WHERE `{$moveColumn}` = :id",
        [':id' => $sourceId]
    );
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

try {
    $pdo = Connection::getConnection();
    // Belt-and-braces: the DSN already pins utf8mb4, this makes the session
    // charset explicit so the accented rename round-trips byte-for-byte.
    $pdo->exec('SET NAMES utf8mb4');
} catch (PDOException $e) {
    fwrite(STDERR, '[ERROR] Cannot connect to database: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

echo '=== MEDMETRIC - Production cleanup, August 2026 ===' . PHP_EOL;
echo 'Mode: ' . ($confirm ? '*** CONFIRM (WRITES, single transaction) ***' : 'DRY RUN (read-only)') . PHP_EOL;

// ---------------------------------------------------------------------------
// Identity guards - ABORT before touching anything if reality does not match.
// ---------------------------------------------------------------------------

heading('IDENTITY GUARDS');

try {
    foreach (EXPECTED_USER_NAMES as $id => $fragment) {
        $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        if (!$row) {
            throw new Abort("Expected user id {$id} does not exist.");
        }
        if (stripos((string) $row['name'], $fragment) === false) {
            throw new Abort("User {$id} name mismatch: expected to contain '{$fragment}', got '{$row['name']}'.");
        }
        printf("  OK  user %-4s %-34s %s%s", $row['id'], $row['name'], $row['email'], PHP_EOL);
    }

    $stmt = $pdo->prepare('SELECT id, name FROM doctors WHERE id = :id');
    $stmt->execute([':id' => DELETE_DOCTOR_ID]);
    $doctor = $stmt->fetch();

    if (!$doctor) {
        throw new Abort('Expected doctor id ' . DELETE_DOCTOR_ID . ' does not exist.');
    }
    if (stripos((string) $doctor['name'], EXPECTED_DOCTOR_NAME_FRAGMENT) === false) {
        throw new Abort("Doctor " . DELETE_DOCTOR_ID . " name mismatch: got '{$doctor['name']}'.");
    }
    printf("  OK  doctor %-2s %s%s", $doctor['id'], $doctor['name'], PHP_EOL);

    $stmt = $pdo->prepare('SELECT email FROM users WHERE id = :id');
    $stmt->execute([':id' => MERGE_TARGET_USER_ID]);
    $targetEmail = (string) $stmt->fetchColumn();
    if ($targetEmail !== MERGE_TARGET_EMAIL) {
        throw new Abort('Merge target email mismatch: expected ' . MERGE_TARGET_EMAIL . ", got {$targetEmail}.");
    }
    echo '  OK  merge target email unchanged: ' . MERGE_TARGET_EMAIL . PHP_EOL;
} catch (Abort $e) {
    fwrite(STDERR, PHP_EOL . '[ABORT] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

heading('BASELINE ROW COUNTS');
$before = printCounts($pdo, 'Row counts BEFORE:');

heading('BLAST RADIUS (read-only)');
printBlastRadius($pdo, MERGE_SOURCE_USER_ID, 'OP1 merge source');
printBlastRadius($pdo, MERGE_TARGET_USER_ID, 'OP1 merge target');
printBlastRadius($pdo, DELETE_USER_JOHANNA_ID, 'OP3 delete');
printBlastRadius($pdo, DELETE_USER_BELEN_ID, 'OP4 delete');

$orphansBefore = [
    'material_views' => scalar($pdo, 'SELECT COUNT(*) AS c FROM material_views WHERE visit_session_id IS NULL'),
    'study_views'    => scalar($pdo, 'SELECT COUNT(*) AS c FROM study_views WHERE visit_session_id IS NULL'),
];
echo '  Orphan baseline (visit_session_id IS NULL): material_views='
    . $orphansBefore['material_views'] . ', study_views=' . $orphansBefore['study_views'] . PHP_EOL;

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

try {
    if ($confirm) {
        $pdo->beginTransaction();
    }

    // =======================================================================
    // OP 1 - Merge user 13 into user 26, rename 26, delete 13.
    // =======================================================================
    heading('OP 1 - MERGE user ' . MERGE_SOURCE_USER_ID . ' INTO user ' . MERGE_TARGET_USER_ID);

    // 1a. Plain reassignments (no UNIQUE key can collide on these tables).
    $plainReassign = [
        ['visit_sessions',         'rep_id'],
        ['material_views',         'viewer_id'],
        ['study_views',            'viewer_id'],
        ['visit_session_comments', 'author_user_id'],
        ['materials',              'manager_id'],
        ['materials',              'approved_by'],
        ['doctors',                'assigned_rep_id'],
        ['doctors',                'created_by_id'],
    ];

    foreach ($plainReassign as [$table, $column]) {
        step(
            $pdo,
            $confirm,
            $affected,
            "{$table}.{$column}: " . MERGE_SOURCE_USER_ID . ' -> ' . MERGE_TARGET_USER_ID,
            "SELECT COUNT(*) AS c FROM `{$table}` WHERE `{$column}` = :id",
            "UPDATE `{$table}` SET `{$column}` = " . MERGE_TARGET_USER_ID . " WHERE `{$column}` = :id",
            [':id' => MERGE_SOURCE_USER_ID]
        );
    }

    // 1b. UNIQUE-guarded reassignments.
    reassignWithUniqueGuard(
        $pdo, $confirm, $affected,
        'rep_manager_access', 'rep_id', 'manager_id',
        MERGE_SOURCE_USER_ID, MERGE_TARGET_USER_ID
    );
    reassignWithUniqueGuard(
        $pdo, $confirm, $affected,
        'rep_manager_access', 'manager_id', 'rep_id',
        MERGE_SOURCE_USER_ID, MERGE_TARGET_USER_ID
    );
    reassignWithUniqueGuard(
        $pdo, $confirm, $affected,
        'manager_brands', 'manager_id', 'brand_id',
        MERGE_SOURCE_USER_ID, MERGE_TARGET_USER_ID
    );

    // Defensive: a self-referencing pair (rep_id = manager_id = 26) could only
    // appear if the source row paired the two merged users. Report it if so.
    // NOTE: native prepares (ATTR_EMULATE_PREPARES = false) do not allow the
    // same named placeholder to appear twice, hence :a / :b for one value.
    $selfPairs = scalar(
        $pdo,
        'SELECT COUNT(*) AS c FROM rep_manager_access WHERE rep_id = :a AND manager_id = :b',
        [':a' => MERGE_TARGET_USER_ID, ':b' => MERGE_TARGET_USER_ID]
    );
    if ($selfPairs > 0) {
        echo "  NOTE: {$selfPairs} self-referencing rep_manager_access row(s) (rep=manager="
            . MERGE_TARGET_USER_ID . ') exist after the merge.' . PHP_EOL;
    }

    // 1c. Rename the surviving user (email intentionally untouched).
    step(
        $pdo,
        $confirm,
        $affected,
        'users: rename ' . MERGE_TARGET_USER_ID . ' to the full accented name',
        'SELECT COUNT(*) AS c FROM users WHERE id = :id AND name <> :name',
        'UPDATE users SET name = :name WHERE id = :id',
        [':id' => MERGE_TARGET_USER_ID, ':name' => MERGE_TARGET_NEW_NAME]
    );

    if ($confirm) {
        $stmt = $pdo->prepare('SELECT name, email, HEX(name) AS hexname FROM users WHERE id = :id');
        $stmt->execute([':id' => MERGE_TARGET_USER_ID]);
        $check = $stmt->fetch();

        if ($check['name'] !== MERGE_TARGET_NEW_NAME) {
            throw new Abort(
                'Accent round-trip FAILED. Stored name does not match the intended value. HEX=' . $check['hexname']
            );
        }
        if ($check['email'] !== MERGE_TARGET_EMAIL) {
            throw new Abort('Email of user ' . MERGE_TARGET_USER_ID . ' changed unexpectedly.');
        }
        echo '  OK  stored name reads back byte-identical: ' . $check['name']
            . ' (HEX ' . $check['hexname'] . ')' . PHP_EOL;
        echo '  OK  email unchanged: ' . $check['email'] . PHP_EOL;
    }

    // 1d. Delete the merged-away user.
    if ($confirm) {
        assertUserDeletable($pdo, MERGE_SOURCE_USER_ID);
    }
    step(
        $pdo,
        $confirm,
        $affected,
        'users: DELETE id ' . MERGE_SOURCE_USER_ID . ' (Claudia Fernandez)',
        'SELECT COUNT(*) AS c FROM users WHERE id = :id',
        'DELETE FROM users WHERE id = :id',
        [':id' => MERGE_SOURCE_USER_ID]
    );

    // =======================================================================
    // OP 2 - Delete doctor 4370 and everything hanging off it.
    // =======================================================================
    heading('OP 2 - DELETE doctor ' . DELETE_DOCTOR_ID . ' and all its data');

    // Re-derived at runtime on purpose. Session ids are never hardcoded.
    $sessionIds = columnList(
        $pdo,
        'SELECT id FROM visit_sessions WHERE doctor_id = :id ORDER BY id',
        [':id' => DELETE_DOCTOR_ID]
    );
    $sessionIn = inList($sessionIds);
    echo '  Sessions of doctor ' . DELETE_DOCTOR_ID . ' (' . count($sessionIds) . '): '
        . ($sessionIds === [] ? '(none)' : implode(',', $sessionIds)) . PHP_EOL;

    // ORDER IS LOAD-BEARING: the two *_views tables are ON DELETE SET NULL, so
    // they must be deleted BEFORE the sessions or they survive as orphans.
    step($pdo, $confirm, $affected,
        'material_views: delete rows of those sessions (SET NULL trap)',
        "SELECT COUNT(*) AS c FROM material_views WHERE visit_session_id IN {$sessionIn}",
        "DELETE FROM material_views WHERE visit_session_id IN {$sessionIn}");

    step($pdo, $confirm, $affected,
        'study_views: delete rows of those sessions (SET NULL trap)',
        "SELECT COUNT(*) AS c FROM study_views WHERE visit_session_id IN {$sessionIn}",
        "DELETE FROM study_views WHERE visit_session_id IN {$sessionIn}");

    step($pdo, $confirm, $affected,
        'visit_session_comments: delete rows of those sessions (explicit)',
        "SELECT COUNT(*) AS c FROM visit_session_comments WHERE visit_session_id IN {$sessionIn}",
        "DELETE FROM visit_session_comments WHERE visit_session_id IN {$sessionIn}");

    step($pdo, $confirm, $affected,
        'visit_session_materials: delete rows of those sessions (explicit)',
        "SELECT COUNT(*) AS c FROM visit_session_materials WHERE visit_session_id IN {$sessionIn}",
        "DELETE FROM visit_session_materials WHERE visit_session_id IN {$sessionIn}");

    step($pdo, $confirm, $affected,
        'visit_sessions: delete sessions of doctor ' . DELETE_DOCTOR_ID . ' (RESTRICT parent)',
        'SELECT COUNT(*) AS c FROM visit_sessions WHERE doctor_id = :id',
        'DELETE FROM visit_sessions WHERE doctor_id = :id',
        [':id' => DELETE_DOCTOR_ID]);

    step($pdo, $confirm, $affected,
        'visit_session_comments: delete strays by doctor_id',
        'SELECT COUNT(*) AS c FROM visit_session_comments WHERE doctor_id = :id',
        'DELETE FROM visit_session_comments WHERE doctor_id = :id',
        [':id' => DELETE_DOCTOR_ID]);

    step($pdo, $confirm, $affected,
        'doctors: DELETE id ' . DELETE_DOCTOR_ID . ' (Prueba - Leonardo Vargas)',
        'SELECT COUNT(*) AS c FROM doctors WHERE id = :id',
        'DELETE FROM doctors WHERE id = :id',
        [':id' => DELETE_DOCTOR_ID]);

    // =======================================================================
    // OP 3 - Delete user 14 and her remaining metrics.
    // =======================================================================
    heading('OP 3 - DELETE user ' . DELETE_USER_JOHANNA_ID . ' (Johanna Jofre)');

    step($pdo, $confirm, $affected,
        'material_views: delete remaining rows of viewer ' . DELETE_USER_JOHANNA_ID,
        'SELECT COUNT(*) AS c FROM material_views WHERE viewer_id = :id',
        'DELETE FROM material_views WHERE viewer_id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]);

    step($pdo, $confirm, $affected,
        'study_views: delete remaining rows of viewer ' . DELETE_USER_JOHANNA_ID,
        'SELECT COUNT(*) AS c FROM study_views WHERE viewer_id = :id',
        'DELETE FROM study_views WHERE viewer_id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]);

    step($pdo, $confirm, $affected,
        'visit_session_comments: delete rows authored by ' . DELETE_USER_JOHANNA_ID,
        'SELECT COUNT(*) AS c FROM visit_session_comments WHERE author_user_id = :id',
        'DELETE FROM visit_session_comments WHERE author_user_id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]);

    $remainingSessions = scalar(
        $pdo,
        'SELECT COUNT(*) AS c FROM visit_sessions WHERE rep_id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]
    );
    if ($remainingSessions !== 0) {
        echo "  NOTE: user " . DELETE_USER_JOHANNA_ID . " still has {$remainingSessions} session(s) "
            . 'not linked to doctor ' . DELETE_DOCTOR_ID . '; they will be purged with their views.' . PHP_EOL;

        $ownSessions = columnList(
            $pdo,
            'SELECT id FROM visit_sessions WHERE rep_id = :id ORDER BY id',
            [':id' => DELETE_USER_JOHANNA_ID]
        );
        $ownIn = inList($ownSessions);

        step($pdo, $confirm, $affected,
            'material_views: delete rows of remaining sessions of ' . DELETE_USER_JOHANNA_ID,
            "SELECT COUNT(*) AS c FROM material_views WHERE visit_session_id IN {$ownIn}",
            "DELETE FROM material_views WHERE visit_session_id IN {$ownIn}");

        step($pdo, $confirm, $affected,
            'study_views: delete rows of remaining sessions of ' . DELETE_USER_JOHANNA_ID,
            "SELECT COUNT(*) AS c FROM study_views WHERE visit_session_id IN {$ownIn}",
            "DELETE FROM study_views WHERE visit_session_id IN {$ownIn}");
    } else {
        echo '  OK  assertion: user ' . DELETE_USER_JOHANNA_ID
            . ' has 0 remaining visit_sessions (all were against doctor ' . DELETE_DOCTOR_ID . ').' . PHP_EOL;
    }

    step($pdo, $confirm, $affected,
        'visit_sessions: delete remaining sessions of rep ' . DELETE_USER_JOHANNA_ID,
        'SELECT COUNT(*) AS c FROM visit_sessions WHERE rep_id = :id',
        'DELETE FROM visit_sessions WHERE rep_id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]);

    // materials.manager_id is RESTRICT: a non-zero count here is unrecoverable.
    $ownedMaterials  = scalar($pdo, 'SELECT COUNT(*) AS c FROM materials WHERE manager_id = :id', [':id' => DELETE_USER_JOHANNA_ID]);
    $approvedMaterials = scalar($pdo, 'SELECT COUNT(*) AS c FROM materials WHERE approved_by = :id', [':id' => DELETE_USER_JOHANNA_ID]);
    printf("  materials.manager_id = %d -> %d | materials.approved_by = %d -> %d%s",
        DELETE_USER_JOHANNA_ID, $ownedMaterials, DELETE_USER_JOHANNA_ID, $approvedMaterials, PHP_EOL);
    if ($ownedMaterials !== 0 || $approvedMaterials !== 0) {
        throw new Abort(
            'User ' . DELETE_USER_JOHANNA_ID . ' still owns/approved materials '
            . "(manager_id={$ownedMaterials}, approved_by={$approvedMaterials}). Refusing to delete."
        );
    }

    if ($confirm) {
        assertUserDeletable($pdo, DELETE_USER_JOHANNA_ID);
    }
    step($pdo, $confirm, $affected,
        'users: DELETE id ' . DELETE_USER_JOHANNA_ID . ' (rep_manager_access cascades)',
        'SELECT COUNT(*) AS c FROM users WHERE id = :id',
        'DELETE FROM users WHERE id = :id',
        [':id' => DELETE_USER_JOHANNA_ID]);

    // =======================================================================
    // OP 4 - Delete user 27 (no metrics).
    // =======================================================================
    heading('OP 4 - DELETE user ' . DELETE_USER_BELEN_ID . ' (Belen Berrios)');

    foreach (USER_FK_COLUMNS as [$table, $column]) {
        $key = "{$table}.{$column}";
        if (in_array($key, USER_FK_CASCADING, true)) {
            continue;
        }
        $n = scalar($pdo, "SELECT COUNT(*) AS c FROM `{$table}` WHERE `{$column}` = :id", [':id' => DELETE_USER_BELEN_ID]);
        if ($n !== 0) {
            throw new Abort("User " . DELETE_USER_BELEN_ID . " unexpectedly has {$n} row(s) in {$key}. Refusing to delete.");
        }
    }
    echo '  OK  assertion: blast radius of user ' . DELETE_USER_BELEN_ID
        . ' is all-zero outside cascading link tables.' . PHP_EOL;

    $belenLinks = scalar(
        $pdo,
        'SELECT COUNT(*) AS c FROM rep_manager_access WHERE rep_id = :a OR manager_id = :b',
        [':a' => DELETE_USER_BELEN_ID, ':b' => DELETE_USER_BELEN_ID]
    );
    $belenLinkIds = columnList(
        $pdo,
        'SELECT id FROM rep_manager_access WHERE rep_id = :a OR manager_id = :b ORDER BY id',
        [':a' => DELETE_USER_BELEN_ID, ':b' => DELETE_USER_BELEN_ID]
    );
    echo "  rep_manager_access rows that will cascade away: {$belenLinks} (ids: "
        . ($belenLinkIds === [] ? 'none' : implode(',', $belenLinkIds)) . ')' . PHP_EOL;

    step($pdo, $confirm, $affected,
        'users: DELETE id ' . DELETE_USER_BELEN_ID . ' (rep_manager_access cascades)',
        'SELECT COUNT(*) AS c FROM users WHERE id = :id',
        'DELETE FROM users WHERE id = :id',
        [':id' => DELETE_USER_BELEN_ID]);

    // =======================================================================
    if ($confirm) {
        $pdo->commit();
        echo PHP_EOL . 'TRANSACTION COMMITTED.' . PHP_EOL;
    }
} catch (Abort $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        fwrite(STDERR, PHP_EOL . 'TRANSACTION ROLLED BACK - nothing was changed.' . PHP_EOL);
    }
    fwrite(STDERR, '[ABORT] ' . $e->getMessage() . PHP_EOL);
    exit(1);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
        fwrite(STDERR, PHP_EOL . 'TRANSACTION ROLLED BACK - nothing was changed.' . PHP_EOL);
    }
    fwrite(STDERR, '[ERROR] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

heading($confirm ? 'RESULT ROW COUNTS' : 'PROJECTED ROW COUNTS (unchanged - dry run)');
$after = printCounts($pdo, $confirm ? 'Row counts AFTER:' : 'Row counts NOW (nothing was written):');

echo 'Delta vs baseline:' . PHP_EOL;
foreach (REPORTED_TABLES as $table) {
    $delta = $after[$table] - $before[$table];
    printf("  %-28s %5d -> %-5d (%+d)%s", $table, $before[$table], $after[$table], $delta, PHP_EOL);
}

$orphansAfter = [
    'material_views' => scalar($pdo, 'SELECT COUNT(*) AS c FROM material_views WHERE visit_session_id IS NULL'),
    'study_views'    => scalar($pdo, 'SELECT COUNT(*) AS c FROM study_views WHERE visit_session_id IS NULL'),
];
echo PHP_EOL . 'Orphans (visit_session_id IS NULL):' . PHP_EOL;
foreach ($orphansAfter as $table => $n) {
    printf("  %-28s before=%d after=%d (%+d)%s", $table, $orphansBefore[$table], $n, $n - $orphansBefore[$table], PHP_EOL);
}

echo PHP_EOL;
if (!$confirm) {
    echo 'DRY RUN - nothing was written. Re-run with --confirm to execute.' . PHP_EOL;
    exit(0);
}

echo 'OK - cleanup completed and committed.' . PHP_EOL;
exit(0);
