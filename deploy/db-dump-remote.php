<?php

/**
 * MEDMETRIC - Remote DB dump helper (used by deploy.ps1 pre-migration backups)
 *
 * Uploaded temporarily into api/ by deploy.ps1, run once, then deleted.
 * Reads DB credentials from the SAME .env used by the API (never printed)
 * and produces a mysqldump backup at the given output path.
 *
 * Usage (run from inside api/, same convention as database/migrate.php):
 *   php _deploy_db_dump.php /absolute/path/to/output.sql
 *
 * KNOWN WEAKNESS: mysqldump receives the password via a CLI flag (-p...),
 * which can be briefly visible in `ps aux` output on shared hosting. This
 * mirrors the existing weakness of passing -pw to plink in deploy.ps1
 * (see comment there). Acceptable tradeoff for a simple shared-hosting
 * deploy script; do not use this pattern for higher-trust environments.
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

$out = $argv[1] ?? null;
if (!$out) {
    fwrite(STDERR, "Usage: php _deploy_db_dump.php <output-file>\n");
    exit(1);
}

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? '3306';
$name = $_ENV['DB_NAME'] ?? '';
$user = $_ENV['DB_USER'] ?? '';
$pass = $_ENV['DB_PASS'] ?? '';

if ($name === '' || $user === '') {
    fwrite(STDERR, "[ERROR] DB_NAME/DB_USER missing from .env - aborting dump.\n");
    exit(1);
}

$cmd = sprintf(
    'mysqldump --no-tablespaces -h%s -P%s -u%s -p%s %s > %s 2>%s',
    escapeshellarg($host),
    escapeshellarg((string) $port),
    escapeshellarg($user),
    escapeshellarg($pass),
    escapeshellarg($name),
    escapeshellarg($out),
    escapeshellarg($out . '.err')
);

// NOTE: passthru()/shell_exec()/system() are disabled via disable_functions on
// this Hostinger shared-hosting PHP CLI. exec() is available and, unlike the
// others, is the one built specifically to also return the real exit code via
// its 3rd by-ref parameter - which is the behavior this script depends on to
// decide whether to abort (see the $code !== 0 check below). $outputLines is
// unused here because stdout/stderr are already redirected to files above.
exec($cmd, $outputLines, $code);

if ($code !== 0) {
    fwrite(STDERR, "[ERROR] mysqldump exited with code {$code}. See {$out}.err\n");
    exit($code);
}

if (!is_file($out) || filesize($out) === 0) {
    fwrite(STDERR, "[ERROR] Dump file missing or empty: {$out}\n");
    exit(1);
}

echo "OK: dump written to {$out} (" . filesize($out) . " bytes)\n";
exit(0);
